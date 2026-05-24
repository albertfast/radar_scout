# Radarbot ana sayfa 3D animasyonu

Bu klasör, Radarbot uygulamasının ana ekranındaki **tel küre + prizma + renkli parçacıklar** animasyonunun kaynaklarının bir kopyasıdır. Proje kökünden bağımsızdır: `/home/asahiner/Documents/radarbot-radar-3d-animation/`

---

## Hangi dosyalar ne işe yarıyor?

### Asıl animasyon (tek dosyada toplanmış)

| Dosya | Rol |
|-------|-----|
| **`RadarAnimation.tsx`** | Tüm animasyon burada. React Native `WebView` içinde **Three.js** (CDN) ile 3D sahne çizer. |

Animasyon için **ayrı `.glb`, `.obj` veya başka asset dosyası yok**. Görüntü tamamen kod ile üretiliyor.

### Projede nerede kullanılıyor?

| Radarbot yolu | Ne zaman görünür? |
|---------------|-------------------|
| `src/screens/RadarScreen.tsx` | Ana sayfa — PRO banner altı, **START SCANNING** üstü |
| `src/screens/components/RadarBasicView.tsx` | Sürüş modunda **Basic** sekmesi — arka planda soluk |

Bu klasördeki `ornek-kullanim-*.tsx` dosyaları, o kullanımların sadeleştirilmiş örnekleridir.

### Tarayıcıda denemek için

| Dosya | Rol |
|-------|-----|
| **`radar-animation-standalone.html`** | Aynı Three.js sahnesi; React Native olmadan Chrome/Firefox’ta açılır. İnternet gerekir (Three.js CDN). |

```bash
xdg-open radar-animation-standalone.html
```

---

## Mimari (nasıl çalışıyor?)

```
┌─────────────────────────────────────┐
│  RadarScreen / RadarBasicView         │
│  <RadarAnimation size={...} />      │
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│  RadarAnimation.tsx (React Native)   │
│  • View (kare kutu, size × size)     │
│  • WebView source={{ html: ... }}    │
│  • Hata olursa: fallback halka/kare  │
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│  htmlContent (string içinde HTML+JS) │
│  • three.js r128 (cdnjs)             │
│  • WebGL canvas, şeffaf arka plan    │
└─────────────────────────────────────┘
```

1. **React Native tarafı** sadece bir kare alan ayırır ve `WebView`’e HTML verir.
2. **WebView** içindeki JavaScript, Three.js ile her karede sahneyi yeniden çizer (`requestAnimationFrame`).
3. **Boyut** `size` prop’u ile gelir; ana sayfada yaklaşık ekran genişliğinin %40’ı, yüksekliğin %19’u (`HOME_RADAR_SIZE`).

---

## 3D sahnede neler var?

### 1. Tel küre (wireframe sphere)

- `SphereGeometry(4, 24, 24)` — yarıçap 4, 24×24 segment
- Renk: `#4ECDC4` (turkuaz), `wireframe: true`, opacity `0.15`
- Yavaşça X ve Y ekseninde döner

### 2. Merkez prizma (altıgen silindir)

- `CylinderGeometry(1.2, 1.2, 2.5, 6)` — 6 kenarlı prizma
- `MeshStandardMaterial` — metalik parlak görünüm, hafif **nefes alma** (scale sinüs ile)
- Üzerinde beyaz tel çizgili `WireframeGeometry` katmanı
- Radardan daha hızlı döner

### 3. Parçacıklar (40 adet küçük küre)

- Renkler: turkuaz, kırmızı, mor (`0x4ECDC4`, `0xFF5252`, `0x8A2BE2`)
- Her biri farklı yörünge yarıçapı ve hızda kürenin etrafında döner (yakındaki radarları simgelemek için tasarlanmış)
- Tüm grup hafifçe Y ve Z’de salınır

### 4. Işık

- `AmbientLight` — genel aydınlatma
- `PointLight` (turkuaz) — prizmada parlama

### 5. Kamera

- `PerspectiveCamera(45°, …)`
- Konum: `(0, 0, 11)` — sahneye tam karşı, merkeze `lookAt(0,0,0)`

---

## Boyut ayarları (Radarbot içinde)

**Ana sayfa** (`RadarScreen.tsx`):

```ts
const HOME_RADAR_SIZE = Math.min(width * 0.4, screenHeight * 0.19);
// ...
<RadarAnimation size={HOME_RADAR_SIZE} />
```

**Basic sekmesi** (`RadarBasicView.tsx`):

```ts
const RADAR_BG_SIZE = Math.min(SCREEN_W * 0.5, SCREEN_H * 0.2);
```

**Varsayılan** (`RadarAnimation.tsx` içinde, prop verilmezse):

```ts
const DEFAULT_SIZE = width * 0.65;
```

Küreyi büyütmek/küçültmek için bu sabitleri veya `<RadarAnimation size={200} />` gibi doğrudan piksel değeri kullanılır.

---

## 3D kodu nerede düzenlenir?

Tüm sahne ve animasyon döngüsü **`RadarAnimation.tsx`** içindeki `` htmlContent` `` template string’inde (yaklaşık satır 12–158).

Örnek değişiklikler:

| İstek | Nerede |
|--------|--------|
| Küre rengi / saydamlığı | `sphereMat` → `color`, `opacity` |
| Parçacık sayısı | `for (let i = 0; i < 40; i++)` döngüsü |
| Dönüş hızı | `animate()` içinde `+= 0.002` gibi değerler |
| Kamera uzaklığı | `camera.position.set(0, 0, 11)` — son sayı |

Değişiklikten sonra uygulamayı yeniden yüklemeniz yeterli (WebView HTML’i yeniden okur).

---

## Fallback (WebView çökmezse)

`WebView` yüklenemezse (`onError` / `onHttpError`):

- Turkuaz **halka** (`fallbackRing`)
- Ortada dönük **kare** (`fallbackCore`)

CDN veya ağ yoksa animasyon yerine bu basit UI görünür.

---

## Bağımlılıklar

```json
"react-native-webview": "13.15.0"
```

Kurulum (başka bir RN projesine taşırsanız):

```bash
npx expo install react-native-webview
```

`RadarAnimation.tsx` dosyasını `src/components/` altına kopyalayıp import edin:

```tsx
import { RadarAnimation } from '../components/RadarAnimation';

<RadarAnimation size={180} />
```

---

## Özet

- **Tek asıl kaynak:** `RadarAnimation.tsx` (RN + WebView + gömülü Three.js).
- **Ana sayfa yerleşimi:** `RadarScreen.tsx` — boyut `HOME_RADAR_SIZE`, etrafında `radarOuterGlow`.
- **İkinci kullanım:** `RadarBasicView.tsx` — daha küçük, arka planda.
- **PC’de önizleme:** `radar-animation-standalone.html`.

Sorular için `DOSYA-HARITASI.md` dosyasındaki proje içi yolları kullanabilirsiniz.
