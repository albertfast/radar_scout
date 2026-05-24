import React, { useMemo } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { RadarLife3DViewProps } from './RadarLife3DView';

const { width } = Dimensions.get('window');
const DEFAULT_SIZE = width * 0.65;

const buildHtmlContent = (paused: boolean) => `
<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0"/>
    <style>
      html, body {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
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
    <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
    <script>
      const RADAR_PAUSED = ${paused ? 'true' : 'false'};
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });

      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearColor(0x000000, 0);
      document.body.appendChild(renderer.domElement);

      const sphereGeo = new THREE.SphereGeometry(4, 24, 24);
      const sphereMat = new THREE.MeshBasicMaterial({
        color: 0x4ECDC4,
        wireframe: true,
        transparent: true,
        opacity: 0.16
      });
      const sphere = new THREE.Mesh(sphereGeo, sphereMat);
      scene.add(sphere);

      const prismGeo = new THREE.CylinderGeometry(1.2, 1.2, 2.5, 6);
      const prismMat = new THREE.MeshStandardMaterial({
        color: 0x4ECDC4,
        emissive: 0x2b807a,
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 0.9,
        roughness: 0.2,
        metalness: 0.8
      });
      const prism = new THREE.Mesh(prismGeo, prismMat);
      scene.add(prism);

      const prismWireGeo = new THREE.WireframeGeometry(prismGeo);
      const prismWireMat = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.48
      });
      prism.add(new THREE.LineSegments(prismWireGeo, prismWireMat));

      const particleGroup = new THREE.Group();
      const colors = [0x4ECDC4, 0xFF5252, 0x8A2BE2];

      for (let i = 0; i < 42; i++) {
        const pGeo = new THREE.SphereGeometry(0.08 + Math.random() * 0.1, 8, 8);
        const pMat = new THREE.MeshBasicMaterial({
          color: colors[Math.floor(Math.random() * colors.length)],
          transparent: true,
          opacity: 0.82
        });
        const particle = new THREE.Mesh(pGeo, pMat);
        const radius = 2.45 + Math.random() * 1.55;
        const angle = Math.random() * Math.PI * 2;
        const yOffset = (Math.random() - 0.5) * 2;

        particle.position.set(Math.cos(angle) * radius, yOffset, Math.sin(angle) * radius);
        particle.userData = {
          speed: 0.005 + Math.random() * 0.015,
          angle,
          radius
        };
        particleGroup.add(particle);
      }
      scene.add(particleGroup);

      scene.add(new THREE.AmbientLight(0xffffff, 0.5));
      const pointLight = new THREE.PointLight(0x4ECDC4, 2, 10);
      pointLight.position.set(0, 0, 0);
      scene.add(pointLight);

      camera.position.set(0, 0, 11);
      camera.lookAt(0, 0, 0);

      function animate() {
        requestAnimationFrame(animate);

        if (!RADAR_PAUSED) {
          sphere.rotation.y += 0.002;
          sphere.rotation.x += 0.001;

          prism.rotation.y -= 0.01;
          prism.rotation.x += 0.005;
          const scale = 1 + Math.sin(Date.now() * 0.003) * 0.05;
          prism.scale.set(scale, scale, scale);

          particleGroup.children.forEach((p) => {
            p.userData.angle -= p.userData.speed;
            p.position.x = Math.cos(p.userData.angle) * p.userData.radius;
            p.position.z = Math.sin(p.userData.angle) * p.userData.radius;
          });

          particleGroup.rotation.y += 0.001;
          particleGroup.rotation.z = Math.sin(Date.now() * 0.001) * 0.1;
        }

        renderer.render(scene, camera);
      }

      animate();

      window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      });
    </script>
  </body>
</html>
`;

const RadarLife3DFallback = ({
  style,
  paused = false,
  themeVariant: _themeVariant,
  rotationSpeed: _rotationSpeed,
  pulseEnabled: _pulseEnabled,
  signalLevel: _signalLevel,
  dangerLevel: _dangerLevel,
  ...viewProps
}: RadarLife3DViewProps) => {
  const htmlContent = useMemo(() => buildHtmlContent(Boolean(paused)), [paused]);

  return (
    <View pointerEvents="none" {...viewProps} style={[styles.wrap, style]}>
      <WebView
        originWhitelist={['*']}
        source={{ html: htmlContent }}
        style={styles.webView}
        containerStyle={styles.webView}
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        bounces={false}
        androidLayerType="hardware"
        javaScriptEnabled
        domStorageEnabled={false}
        automaticallyAdjustContentInsets={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    width: DEFAULT_SIZE,
    height: DEFAULT_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  webView: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
});

export default RadarLife3DFallback;
