# Fluent Explorer

Clone de l’Explorateur de fichiers Windows 11, construit avec **Electron + React + TypeScript** et
pensé pour **Windows, macOS et Linux**.

Interface Fluent (Mica, Segoe UI Variable, accent système), onglets, volet de navigation, barre de
commandes, fil d’Ariane, recherche récursive, 4 modes d’affichage, volet de prévisualisation,
glisser-déposer et opérations de fichiers réelles.

La page **Accueil** reprend les sections de l’Explorateur Windows 11 : **Accès rapide**,
**Favoris**, **Partage** et **Activité récente**.

---

## 1. Analyse REA de l’Explorateur Windows (preuves)

Cible analysée : `C:\Windows\explorer.exe`

| Élément | Valeur observée |
| --- | --- |
| SHA-256 | `ca8c0a2a00f1d6f6da076d1d61fa706e82df57ed2b12ae3b3c36f4f73556b2ec` |
| Version fichier | 10.0.26100.1301 (Windows 11 24H2) |
| Format | PE32+ / x86-64, 3 067 376 octets |
| Description | « Explorateur Windows » (Microsoft Corporation) |
| Evidence PE | `ev_c4243c69…aff3f21` (inspect_pe_resources) |
| Evidence inventaire | `ev_7872dc4a…c226308e` (inspect_artifact) |

Ressources PE observées (207 entrées) :

- 181 × `RT_ICON` (id 3), 23 × `RT_GROUP_ICON` (id 14) dont le groupe nommé `ICO_MYCOMPUTER`,
  1 × `RT_VERSION`, 1 × `RT_MANIFEST`, 1 × ressource `MUI`.
- Manifeste extrait (offset 2353024, 1327 octets) :
  - `assemblyIdentity` : `Microsoft.Windows.pcshellshell.explorer` 5.1.0.0, `amd64` ;
  - dépendance `Microsoft.Windows.Common-Controls` 6.0.0.0 ;
  - `requestedExecutionLevel level="asInvoker"` ;
  - `dpiAwareness = PerMonitorV2`.

Interprétation (observations ⇒ conséquences pour le clone) :

1. `explorer.exe` est un **hôte Win32** : peu de chaînes d’interface (recherche de chaînes UTF‑16 :
   `search`, `view`, `home`, `copy`, `cut`, `share`, `network`, `refresh`, `delete`, `recycle`), les
   libellés vivent dans les DLL/MUI du shell (`shell32.dll`, `windows.storage.dll`,
   `twinui.pcshell.dll`, `Windows.FileExplorer.Common.dll`). Le clone doit donc reproduire le
   **comportement et la mise en page**, pas copier des chaînes.
2. `PerMonitorV2` + `asInvoker` ⇒ l’application n’a pas besoin d’élévation et doit rester nette en
   multi-écrans/DPI mixte (Electron gère cela nativement).
3. Les 23 groupes d’icônes confirment que les icônes de fichiers/dossiers sont **fournies par le
   shell** (extensions, dossiers spéciaux) : le clone interroge les icônes système réelles via
   `app.getFileIcon()` pour les fichiers et embarque ses propres icônes SVG couleur pour les dossiers.
   Limite observée sur Windows 11 24H2 / Electron 44 : `app.getFileIcon()` renvoie l’icône générique
   « Ce PC » pour **tous les répertoires** (les fichiers, eux, ont la bonne icône). Un jeu d’icônes
   Fluent couleur (dossier, Documents, Téléchargements, Images, Musique, Vidéos, Bureau, Galerie,
   Accueil, Ce PC, disque, USB, réseau, OneDrive) est donc dessiné et embarqué localement, sans
   assets Microsoft.

Limites de l’analyse (à conserver) :

- Décompilation indisponible : le provider Ghidra n’est pas configuré (`GHIDRA_INSTALL_DIR` absent),
  et le paquet WinUI `Microsoft.Windows.FileExplorer` est protégé par les ACL de
  `C:\Program Files\WindowsApps`. Aucune pseudocode/assembleur n’a donc été produit.
- Les ressources `RT_STRING` ne sont pas décodées par l’outil PE et `explorer.exe` n’en contient pas.
- Aucune observation runtime de l’interface n’a été faite (le module d’observation UI native est
  réservé à macOS).
- Conclusion : l’identité, le manifeste, le modèle DPI, l’inventaire d’icônes et l’architecture
  « hôte + DLL shell » sont **observés** ; la disposition exacte des contrôles et les libellés sont
  **repris du produit** (Windows 11 24H2), pas décompilés.

## 2. Fonctionnalités implémentées

- **Onglets** (Ctrl+T, Ctrl+W, clic molette, menu contextuel d’onglet, nouvelle fenêtre).
- **Navigation** : précédent/suivant, monter, actualiser, historique par onglet, fil d’Ariane
  cliquable, édition du chemin (Ctrl+L), chemins UNC/Unix.
- **Volet de navigation** : Accueil, Galerie, Accès rapide (épinglage persistant), **Ce PC**
  (titre cliquable) avec disques nommés comme l’Explorateur (« Disque local (C:) », « jee (D:) »),
  dossiers utilisateur, Réseau.
- **Page Accueil** (comme Windows 11), ouverte au démarrage :
  - **Accès rapide** : dossiers épinglés + dossiers personnels (Bureau, Documents, Téléchargements,
    Images, Musique, Vidéos), avec libellés traduits ;
  - **Favoris** : ajout/retrait par clic droit sur un fichier ou un dossier (« Ajouter aux favoris » /
    « Retirer des favoris »), suppression directe depuis la page ;
  - **Partage** : section présente avec état vide explicite ;
  - **Activité récente** : fichiers récemment ouverts, lus depuis les raccourcis du dossier
    « Récent » de Windows, `recently-used.xbel` sous Linux et l’historique interne de l’application
    (max. 12 éléments, doubles-clics pour ouvrir).
- **Onglets multiples** : bouton `+`, double-clic dans la barre d’onglets, **Ctrl+T**, **Ctrl+W**,
  clic molette, menu contextuel (nouvel onglet, dupliquer, fermer, fermer les autres).
- **Vue Ce PC** : dossiers personnels et lecteurs en cartes, avec nom du volume, jauge d’occupation
  et espace libre/total ; double-clic pour ouvrir, menu contextuel (ouvrir, nouvel onglet, propriétés).
- **Barre de commandes** : Nouveau, Couper, Copier, Coller, Renommer, Supprimer, Partager (désactivé),
  Trier, Affichage, « … ».
- **Affichages** : Détails (colonnes triables), Liste, Vignettes, Icônes ; tailles d’icônes.
- **Sélection** : clic, Ctrl, Maj (plage), Ctrl+A, flèches, Échap ; sélection multiple au clic droit.
- **Opérations** : création de dossier (renommage immédiat), renommage inline (F2), corbeille
  (`shell.trashItem`), suppression définitive (Maj+Suppr avec confirmation), copier/couper/coller,
  glisser-déposer interne (déplacement) et externe (copie).
- **Presse-papiers système** : les fichiers copiés sont publiés en `text/uri-list` + `text/plain`
  (API asynchrone `clipboard.write()` d’Electron 44), et le collage accepte les listes d’URI
  `file://` comme les chemins en texte brut.
- **Recherche** récursive (profondeur/limites bornées) avec résultats et emplacement.
- **Volet de prévisualisation** : aperçu d’image, extrait de texte, métadonnées.
- **Propriétés** : icône, type de fichier, emplacement, taille, taille sur disque, contenu des
  dossiers (nombre de fichiers/dossiers et taille), dates (création/modification/accès), attributs,
  cible de lien. Raccourci **Alt+Entrée** comme dans l’Explorateur.
- **Propriétés d’un lecteur** (clic droit sur un disque, y compris dans Ce PC ou sur le fond d’un
  disque) : nom du volume, type, système de fichiers (NTFS, ext4, APFS…), anneau d’occupation
  utilisé/libre et capacité, comme le vrai Explorateur.
- **Thème** : clair/sombre/système, couleur d’accent système, Mica sous Windows 11, vibrancy macOS.
- **Icônes** : icônes système réelles pour les fichiers (PDF, Word, vidéos…), icônes SVG couleur
  embarquées pour les dossiers (générique, Documents, Téléchargements, Images, Musique, Vidéos,
  Bureau, OneDrive) et le volet de navigation (Accueil, Galerie, Ce PC, disques, USB, réseau) ;
  repli Fluent cross-platform. L’icône de l’application reprend le **dossier jaune de
  l’Explorateur** (`resources/icon.png`), utilisée pour la fenêtre, la barre des tâches, le Dock
  macOS et les paquets générés.
- **i18n** : français / anglais selon la locale du système.

## 3. Architecture

```
src/
  shared/types.ts        types + canaux IPC
  main/
    index.ts             fenêtre, Mica, IPC, shell, presse-papiers
    fsops.ts             lecture/écriture, recherche, corbeille, transferts, icônes
    store.ts             réglages persistants (userData/settings.json)
  preload/index.ts       pont contextIsolation (aucun Node dans le renderer)
  renderer/
    index.html
    src/
      App.tsx            état des onglets, commandes, raccourcis, menus
      Chrome.tsx         onglets, barre de commandes, fil d’Ariane, barre d’état
      HomeView.tsx       page Accueil (Accès rapide, Favoris, Partage, Activité récente)
      NavPane.tsx        volet de navigation
      FileView.tsx       vues détails/liste/vignettes/icônes, drag & drop, aperçu
      Dialogs.tsx        propriétés, confirmation
      ui.tsx             menus, dialogues, cases à cocher
      styles.css         design Fluent (tokens clair/sombre, Mica)
```

Sécurité : `contextIsolation: true`, `nodeIntegration: false`, API IPC explicite et typée.

## 4. Lancer le projet

Prérequis : **Node.js 20+** (22 conseillé) et npm. Le binaire Electron est téléchargé par
`npm install` pour la plateforme courante : ne copiez jamais `node_modules/` d’un système à l’autre,
refaites l’installation sur chaque machine.

```bash
npm install
npm run dev        # développement (HMR)
npm run build      # build de production dans out/
npm start          # prévisualisation du build
```

**Windows (PowerShell)**

```powershell
cd "C:\Users\Duval David\Documents\fluent-explorer"
npm install
npm run dev
```

Si le binaire Electron n’a pas été téléchargé par `npm install` (réseau bloqué), lancez directement :

```powershell
npm run build
.\node_modules\electron\dist\electron.exe .
```

**macOS**

```bash
cd fluent-explorer
npm install
npm run dev
```

- Mica est remplacé par le vibrancy natif (`under-window`) et les feux tricolores sont placés dans
  la barre de titre.
- Pour une application empaquetée non signée, ouvrez-la avec clic droit → **Ouvrir** (Gatekeeper).

**Linux**

```bash
cd fluent-explorer
npm install
npm run dev
```

- Pas de Mica : fond Fluent opaque avec la couleur d’accent du système.
- Les disques sont lus dans `/proc/mounts` (capacité via `statfs`), les volumes macOS dans `/Volumes`.
- Si votre distribution bloque le sandbox Electron (erreur `SUID sandbox`), lancez le build avec
  `./node_modules/.bin/electron . --no-sandbox` ou installez `libgtk-3`, `libnss3`, `libasound2`.

## 5. Distribuer

```bash
npm run dist:win     # NSIS + portable  → release/
npm run dist:mac     # DMG              → release/
npm run dist:linux   # AppImage + deb   → release/
```

> Chaque build doit être produit sur son système : macOS pour le DMG (signature/notarisation),
> Windows pour le NSIS, Linux pour l’AppImage/le deb. Pour lancer l’AppImage :
> `chmod +x release/*.AppImage && ./release/*.AppImage`.

## 6. Versioning Git

Le projet est versionné avec Git et inclut un fichier **`.gitignore`** à la racine :

```gitignore
node_modules/
out/
dist/
release/
*.log
*.err
smoke*.out
.DS_Store
Thumbs.db
desktop.ini
.idea/
.vscode/
```

Commandes utiles :

```bash
git status
git log --oneline
git add .
git commit -m "Description de la modification"
```

Pour repartir d’un clone propre : `git clone <dépôt> && cd fluent-explorer && npm install`.

## 7. Limites connues

- Pas de décompilation du shell Windows (Ghidra non configuré) : la fidélité visuelle vient du
  produit, pas du binaire.
- Pas de « Ouvrir avec » complet sur macOS/Linux (fallback `open`/`xdg-open`).
- Pas de tri par groupes, pas de colonnes personnalisables, pas de ruban « Partager ».
- Les attributs cachés Windows (`FILE_ATTRIBUTE_HIDDEN`) ne sont pas lus : le filtre repose sur les
  noms en `.`, une liste de fichiers système (`desktop.ini`, `thumbs.db`, `ntuser.dat*`, `AppData`…)
  et les jonctions d’héritage (`Application Data`, `Cookies`, `Menu Démarrer`, `Mes documents`…).
- Le glisser **sortant** vers d’autres applications n’est pas câblé (le glisser entrant/interne l’est).
- Réseau : navigation limitée aux chemins montés (pas de découverte SMB/voisinage).
