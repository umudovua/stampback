import { Hud } from '../hud/Hud';

/**
 * HTML qatı. M1-də yalnız HUD göstərilir; lobby və otaq ekranları M3-də gəlir.
 * Serverə qoşulma kodu (`net/connect.ts`) M3-ə qədər istifadə olunmur.
 */
export function App() {
  return (
    <main>
      <div class="title-stamp">Stampback</div>
      <Hud />
    </main>
  );
}
