// Pencereleri aniden değil, kısa bir solma/küçülme ile kapatmak için.

import { useCallback, useEffect, useRef, useState } from "react";

export const KAPANIS_MS = 220;

/** [kapanıyor mu, kapat]: kapat çağrılınca önce animasyon (KAPANIS_MS), sonra gerçek kapatma. */
export function useYumusakKapat(onKapat: () => void): [boolean, () => void] {
  const [kapaniyor, setKapaniyor] = useState(false);
  const zaman = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(zaman.current), []);
  const kapat = useCallback(() => {
    if (zaman.current) return;
    setKapaniyor(true);
    zaman.current = setTimeout(() => {
      zaman.current = undefined;
      setKapaniyor(false); // aynı pencere sonra yeniden açılabilsin
      onKapat();
    }, KAPANIS_MS);
  }, [onKapat]);
  return [kapaniyor, kapat];
}
