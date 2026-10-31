# Stampback — Vizual üslub bələdçisi v0.1

> Seçilmiş istiqamət: **yumşaq 3D, plastilin kimi**. Bu sənəd AI ilə şəkil yaradarkən hər dəfə istifadə olunur ki,
> bütün assetlər eyni üslubda olsun. Prompt-lar ingiliscədir, çünki AI şəkil alətləri ingilis dilində ən dəqiq işləyir.

## 1. Üslub

- **Material:** matt plastilin, əl ilə yoğrulmuş hissi, səthdə çox incə barmaq izi fakturası. Parlaq plastik deyil.
- **Formalar:** yumru kənarlar, şişkin və bir az “tombul” nisbətlər, oyuncaq kimi.
- **İşıq:** yumşaq studiya işığı yuxarı-soldan; yumşaq ambient occlusion; sərt kölgə yoxdur.
- **Palitra:** isti pastel. Karton `#C9955F`, açıq karton `#E2BE8E`, krem `#F6EEDF`, möhür qırmızısı `#B8322A`,
  mürəkkəb göyü `#23314F`. Oyunçu rəngləri skotçda və etiketlərdə istifadə olunur, kodla rənglənir.
- **Kamera:** obyektlər düz öndən (ortoqrafik), mərkəzdə. Arxa plan da öndən, perspektivsiz.
- **Qadağalar:** şəkillərdə mətn, hərf, loqo yoxdur (mətnlər 4 dilə tərcümə olunur və kodla yazılır);
  prompt-da mövcud oyunların, studiyaların, rəssamların və personajların adları istifadə edilmir.

## 2. Bölgü: AI nə edir, kod nə edir

| Hissə                                  | Kim hazırlayır                                                        | Səbəb                                                             |
| -------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 7 normal bağlama (tetromino formaları) | Kod: AI fakturası ilə doldurulur, yuvarlaq kənar, işıq və kölgə kodla | AI dəqiq formalar çəkə bilmir; forma fizikaya tam uyğun olmalıdır |
| Karton və skotç fakturası              | AI (bir dəfə)                                                         | Bütün bağlamalar eyni materialdan görünür                         |
| 5 hədiyyə bağlaması                    | AI, hər biri tək əşya kimi                                            | Unikal, tanınan obyektlərdir                                      |
| Arxa plan, piştaxta                    | AI                                                                    | Böyük, tək şəkillərdir                                            |
| Möhürlər, etiketlər                    | AI çərçivə + kodla mətn                                               | Mətn 4 dildə olmalıdır                                            |
| HUD, düymələr                          | Kod (CSS)                                                             | Ölçüsü və dili dəyişir                                            |

## 3. Texniki tələblər

- **Format:** PNG. Əşyalar şəffaf fonda (alət şəffaf fon vermirsə, ağ fonda yaradın, fonu sonra mən silərəm).
- **Ölçü:** ən azı 1024×1024; arxa plan 1080×1920 (şaquli, 9:16).
- **Variantlar:** hər prompt üçün 4 variant yaradın, ən yaxşısını seçin.
- **Lisenziya:** aləti seçməzdən əvvəl istifadə şərtlərində kommersiya istifadəsinə icazə olduğunu yoxlayın.
- **Qeydiyyat:** hər seçilmiş şəkil üçün alət, tarix və prompt `docs/art-log.md`-də saxlanılır.
- **Göndərmə:** şəkilləri söhbətə yükləyin; mən təmizləyib `packages/client/public/assets/` qovluğuna əlavə edirəm.

## 4. Ortaq üslub hissəsi

Hər prompt bu hissə ilə başlayır:

```text
soft 3D clay render, handmade plasticine look, matte surface with subtle fingerprint texture,
rounded soft edges, gentle studio lighting from the upper left, soft ambient occlusion,
warm pastel palette
```

## 5. Test partiyası (əvvəl bunlar)

Üslubun xoşunuza gəlib-gəlmədiyini yoxlamaq üçün əvvəl yalnız üç şəkil.

**T1 — karton fakturası** (kvadrat, 1:1):

```text
soft 3D clay render, handmade plasticine look, matte surface with subtle fingerprint texture,
rounded soft edges, gentle studio lighting from the upper left, soft ambient occlusion,
warm pastel palette, seamless tileable texture of kraft cardboard made of clay,
flat top-down view, even lighting, no shadows, no objects, no text
```

**T2 — hədiyyə bağlaması “ağır seyf”** (kvadrat, 1:1):

```text
soft 3D clay render, handmade plasticine look, matte surface with subtle fingerprint texture,
rounded soft edges, gentle studio lighting from the upper left, soft ambient occlusion,
warm pastel palette, a small heavy steel safe shaped like a parcel, chunky and cute,
dark blue-grey clay with a round dial, a strip of brown packing tape across the top,
front orthographic view, centered, isolated on a plain white background, no text, no logo
```

**T3 — arxa plan** (şaquli, 9:16):

```text
soft 3D clay render, handmade plasticine look, matte surface with subtle fingerprint texture,
rounded soft edges, gentle studio lighting from the upper left, soft ambient occlusion,
warm pastel palette, interior of a cozy toy post office seen straight from the front,
shelves with small parcels and envelopes far in the background, very shallow depth of field
so the background is softly blurred, low contrast, calm warm beige and soft teal tones,
large empty space in the center, no people, no text
```

## 6. Sonrakı partiyalar (test bəyənildikdən sonra)

1. Qalan 4 hədiyyə bağlaması: dondurulmuş bağlama, şlyapa qutusu, KÖVRƏK qutu, hava şarlı bağlama.
2. Skotç zolağı (boz rəngdə, kodla oyunçu rənginə boyanır) və ünvan etiketi.
3. Poçt piştaxtası (platforma) və finiş zeplini.
4. Möhür çərçivələri: “GERİ QAYTARILDI”, “TƏCİLİ”, “QAYTARILMAZ” üçün boş çərçivələr.
5. Kuryer personajı (bir əsas personaj, rənglər kodla dəyişir), göyərçinlər, emote ikonları.
