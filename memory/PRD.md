# Ore Planetare - PRD

## Descriere
Aplicație Android pentru calcularea și afișarea orelor planetare bazată pe algoritmul NOAA pentru răsărit/apus.

## Tehnologii
- **Frontend**: React Native / Expo SDK 54
- **Platforma**: Android
- **Limba**: Română (RO)

## Funcționalități Implementate

### v1.0 - Core Features
- Calculator ore planetare bazat pe algoritm NOAA de înaltă precizie
- Detectare automată locație via GPS
- Căutare locație după nume
- Introducere manuală coordonate
- Salvare multiple locații
- Afișare oră planetară curentă cu animații
- Lista completă a celor 24 ore planetare (12 zi + 12 noapte)
- Case cerești pentru fiecare oră
- Timer până la următoarea oră planetară

### v1.1 - Localizare Română (22 Feb 2026)
- Toate textele UI traduse în română
- Informații planete în română:
  - Saturn: Disciplină și Structură
  - Jupiter: Expansiune și Abundență  
  - Marte: Energie și Acțiune
  - Soare: Vitalitate și Succes
  - Venus: Iubire și Armonie
  - Mercur: Comunicare și Intelect
  - Luna: Intuiție și Emoție
- Mesaje de eroare și alerte în română
- Nume aplicație: "Ore Planetare"

## Planete și Semnificații (RO)
| Planetă | Simbol | Vibrație | Cuvinte Cheie |
|---------|--------|----------|---------------|
| Saturn | ♄ | Disciplină și Structură | Responsabilitate, Răbdare, Înțelepciune |
| Jupiter | ♃ | Expansiune și Abundență | Noroc, Prosperitate, Creștere |
| Marte | ♂ | Energie și Acțiune | Curaj, Forță, Pasiune |
| Soare | ☉ | Vitalitate și Succes | Leadership, Creativitate, Bucurie |
| Venus | ♀ | Iubire și Armonie | Iubire, Frumusețe, Artă |
| Mercur | ☿ | Comunicare și Intelect | Comunicare, Învățare, Logică |
| Luna | ☽ | Intuiție și Emoție | Intuiție, Vise, Emoții |

## Build Android APK
```bash
cd frontend
npx expo prebuild --platform android
cd android
./gradlew assembleRelease
```

## Next Steps / Backlog
- P1: Widget pentru home screen Android
- P1: Notificări la schimbarea orei planetare
- P2: Calendar lunar cu ore planetare
- P2: Export PDF cu orele zilei
- P3: Teme de culoare personalizate
