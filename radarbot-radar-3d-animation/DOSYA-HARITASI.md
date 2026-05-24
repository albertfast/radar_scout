# Dosya haritası (Radarbot projesi içindeki karşılıklar)

| Bu klasördeki dosya | Radarbot projesindeki asıl yol |
|---------------------|----------------------------------|
| `RadarAnimation.tsx` | `src/components/RadarAnimation.tsx` |
| `ornek-kullanim-ana-sayfa.tsx` | `src/screens/RadarScreen.tsx` (satır ~1655 civarı) |
| `ornek-kullanim-basic-tab.tsx` | `src/screens/components/RadarBasicView.tsx` (satır ~252 civarı) |
| `radar-animation-standalone.html` | `RadarAnimation.tsx` içindeki `htmlContent` string’inin tarayıcı sürümü |

## Bağımlılıklar (package.json)

- `react-native-webview` — WebView ile HTML/Three.js çalıştırır
- `react`, `react-native` — bileşen çerçevesi

Animasyonun **3D kodu ayrı bir .ts dosyasında değil**; `RadarAnimation.tsx` içindeki `htmlContent` sabit string’inde (satır 12–158).


xdg-open /home/asahiner/Documents/radarbot-radar-3d-animation/radar-animation-standalone.html

boyle calistirdim ben, resminide ayni klasorun icinde gorebilirisin
