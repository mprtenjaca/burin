const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

/**
 * Vlastita inačica Metrovog `exclusionList` (metro-config 0.84 ga izlaže
 * samo kao `metro-config/private/…` — put koji se smije promijeniti bez
 * najave, a projekt već zna koliko takvih sitnica ispliva pri dizanju
 * SDK-a). Uzorci se pišu s `/`; svaki `/` postaje `[\\/]`, pa isti popis
 * pogađa i Windows (`\`) i POSIX (`/`) putanje. Metrov zadani izuzetak
 * `__tests__` je pridodan da ga prepisivanje `blockList` ne izbaci.
 */
function blockListFrom(patterns) {
  const all = [...patterns, /\/__tests__\/.*/];
  const sources = all.map((re) => re.source.replace(/\\\/|\//g, "[\\\\/]"));
  return new RegExp(`(${sources.join("|")})$`);
}

const config = getDefaultConfig(__dirname);

/**
 * WATCHMAN SE MORA UKLJUČITI IZRIČITO (7.9.2026., Markov nalaz: "stoji u
 * ovoj fazi nekad i preko minutu").
 *
 * Expo u `getDefaultConfig` postavlja `resolver.useWatchman = null`
 * (`@expo/metro-config/build/ExpoMetroConfig.js`, "currently defaulting to
 * false"), a Metro u `#shouldUseWatchman()` vraća `false` za svaku falsy
 * vrijednost. Posljedica: watchman je na ovom računalu bio instaliran i
 * pratio je mapu projekta, a Metro ga NIJE PITAO — nego je pri svakom
 * pokretanju Node-om obilazio cijelo stablo (~105 000 datoteka, 96 % u
 * `node_modules`), što je na Windowsima bez `fs` cachea ta minuta čekanja
 * iza "Starting Metro Bundler".
 *
 * Expo to gasi da izbjegne SPORI put kad watchmana NEMA (Metro tada
 * poseže za `find`, koji na Windowsima ne postoji ili je spor). Ovdje ga
 * ima (`scoop`), pa `true` znači: obilazak radi watchman iz svoje žive
 * baze, a Metro dobiva samo razliku. Ako watchman ikad zapne, prvi lijek
 * je `npx expo start --dev-client -c`, drugi `watchman watch-del-all`.
 */
config.resolver.useWatchman = true;

/**
 * ŠTO METRO NE SMIJE OBILAZITI (isti nalaz).
 *
 * Metro pri pokretanju gradi kartu datoteka nad CIJELIM stablom projekta.
 * Izmjereno u ovom repou:
 *
 *   node_modules        100 800 datoteka  (nužno — odatle se uvozi)
 *   android/app/build     2 567 datoteka  (gradle izlaz — ništa se ne uvozi)
 *   .git                  1 208 datoteka
 *
 * `node_modules` je 96 % obilaska i mora ostati; ovaj popis skida ostatak.
 * Iz `android/*​/build` i `.git` se ne uvozi ni jedan modul, a na Windowsima
 * je obilazak stabla (bez `fs` cachea kakav ima Linux) najskuplji dio
 * pokretanja. APK u korijenu (`*.apk`) je jedan `stat` — zanemarivo, ali
 * ni to nema što tražiti u karti modula.
 *
 * `.gitignore` ovdje NE pomaže — Metro ga ne čita; ima vlastiti popis.
 * Isti popis stoji i u `.watchmanconfig`, jer watchman i Metro pretražuju
 * odvojeno.
 *
 * Ovo su izlazi gradnje i povijest, ne izvorni kod — kad `prebuild` ili
 * `run:android` ponovno stvore `android/`, ništa se ne mijenja.
 *
 * Kroz `blockListFrom`, NE kao golo polje regexa: Metro uspoređuje
 * blockList s APSOLUTNOM putanjom, koja na Windowsima nosi obrnute kose
 * crte — regex pisan s `/` ondje nikad ne pogodi, pa popis tiho ne radi
 * (provjereno skriptom nad pravim putanjama, 7.9.2026.).
 */
config.resolver.blockList = blockListFrom([/\/android\/build\/.*/, /\/android\/app\/build\/.*/, /\/android\/\.gradle\/.*/, /\/ios\/build\/.*/, /\/ios\/Pods\/.*/, /\/\.git\/.*/, /.*\.apk/]);

module.exports = withNativeWind(config, {
  input: "./global.css",
});
