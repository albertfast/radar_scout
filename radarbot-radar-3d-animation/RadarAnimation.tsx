import React, { useState } from 'react';
import { View, Dimensions, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

const { width } = Dimensions.get('window');
const DEFAULT_SIZE = width * 0.65;

type RadarAnimationProps = {
  size?: number;
};

const htmlContent = `
<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0"/>
    <style>
      body {
        margin: 0;
        padding: 0;
        overflow: hidden;
        background-color: transparent;
      }
      canvas {
        display: block;
        width: 100vw;
        height: 100vh;
      }
    </style>
  </head>
  <body>
    <!-- Import Three.js -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
    <script>
      // Scene setup
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(window.devicePixelRatio);
      document.body.appendChild(renderer.domElement);

      // 1. Wireframe Radar Sphere
      const sphereGeo = new THREE.SphereGeometry(4, 24, 24);
      const sphereMat = new THREE.MeshBasicMaterial({ 
        color: 0x4ECDC4, 
        wireframe: true, 
        transparent: true, 
        opacity: 0.15 
      });
      const sphere = new THREE.Mesh(sphereGeo, sphereMat);
      scene.add(sphere);

      // 2. The PRISM Core (Hexagonal Prism)
      const prismGeo = new THREE.CylinderGeometry(1.2, 1.2, 2.5, 6);
      const prismMat = new THREE.MeshStandardMaterial({
        color: 0x4ECDC4,
        emissive: 0x2b807a,
        emissiveIntensity: 0.8,
        wireframe: false,
        transparent: true,
        opacity: 0.9,
        roughness: 0.2,
        metalness: 0.8
      });
      const prism = new THREE.Mesh(prismGeo, prismMat);
      scene.add(prism);

      // Inner wireframe for the prism to make it look techy
      const prismWireGeo = new THREE.WireframeGeometry(prismGeo);
      const prismWireMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
      const prismWire = new THREE.LineSegments(prismWireGeo, prismWireMat);
      prism.add(prismWire);

      // 3. Glowing Orbiting Particles (representing nearby radars)
      const particleGroup = new THREE.Group();
      const colors = [0x4ECDC4, 0xFF5252, 0x8A2BE2]; // Teal, Red, Purple

      for (let i = 0; i < 40; i++) {
        const pGeo = new THREE.SphereGeometry(0.08 + Math.random() * 0.1, 8, 8);
        const pMat = new THREE.MeshBasicMaterial({ 
          color: colors[Math.floor(Math.random() * colors.length)],
          transparent: true,
          opacity: 0.8
        });
        const particle = new THREE.Mesh(pGeo, pMat);
        
        // Random orbit distance and angle
        const radius = 2.5 + Math.random() * 1.5;
        const angle = Math.random() * Math.PI * 2;
        const yOffset = (Math.random() - 0.5) * 2;
        
        particle.position.set(Math.cos(angle) * radius, yOffset, Math.sin(angle) * radius);
        
        // Store individual rotation speed
        particle.userData = {
          speed: 0.005 + Math.random() * 0.015,
          angle: angle,
          radius: radius
        };
        
        particleGroup.add(particle);
      }
      scene.add(particleGroup);

      // 4. Lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
      scene.add(ambientLight);
      
      const pointLight = new THREE.PointLight(0x4ECDC4, 2, 10);
      pointLight.position.set(0, 0, 0);
      scene.add(pointLight);

      // Positioning — centered so sphere is symmetric in the widget
      camera.position.set(0, 0, 11);
      camera.lookAt(0, 0, 0);

      // Animation Loop
      function animate() {
        requestAnimationFrame(animate);

        // Rotate wireframe sphere
        sphere.rotation.y += 0.002;
        sphere.rotation.x += 0.001;

        // Rotate and pulse the central PRISM
        prism.rotation.y -= 0.01;
        prism.rotation.x += 0.005;
        const scale = 1 + Math.sin(Date.now() * 0.003) * 0.05;
        prism.scale.set(scale, scale, scale);

        // Rotate particles
        particleGroup.children.forEach(p => {
          p.userData.angle -= p.userData.speed;
          p.position.x = Math.cos(p.userData.angle) * p.userData.radius;
          p.position.z = Math.sin(p.userData.angle) * p.userData.radius;
        });
        
        // Slow rotation of the whole particle system for extra depth
        particleGroup.rotation.y += 0.001;
        particleGroup.rotation.z = Math.sin(Date.now() * 0.001) * 0.1;

        renderer.render(scene, camera);
      }
      
      animate();

      // Handle resize
      window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      });
    </script>
  </body>
</html>
`;

export const RadarAnimation = ({ size = DEFAULT_SIZE }: RadarAnimationProps) => {
  const [webFailed, setWebFailed] = useState(false);

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <View
        style={[
          styles.fallbackRing,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
        ]}
      />
      {!webFailed ? (
        <WebView
          originWhitelist={['*']}
          source={{ html: htmlContent }}
          style={{ width: size, height: size, backgroundColor: 'transparent' }}
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          bounces={false}
          containerStyle={{ width: size, height: size, backgroundColor: 'transparent' }}
          androidLayerType="hardware"
          onError={() => setWebFailed(true)}
          onHttpError={() => setWebFailed(true)}
        />
      ) : null}
      {webFailed ? (
        <View
          style={[
            styles.fallbackCore,
            {
              width: size * 0.35,
              height: size * 0.35,
              borderRadius: size * 0.08,
            },
          ]}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fallbackRing: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(78, 205, 196, 0.35)',
    backgroundColor: 'rgba(78, 205, 196, 0.06)',
  },
  fallbackCore: {
    position: 'absolute',
    backgroundColor: 'rgba(78, 205, 196, 0.45)',
    transform: [{ rotate: '45deg' }],
  },
});
