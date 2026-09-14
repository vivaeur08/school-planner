# 📚 SchoolPlanner

> Mon agenda scolaire intelligent - Accessible partout, sur tous mes écrans !

## ✨ Fonctionnalités

- 📅 **Semainier** - Vue d'ensemble de la semaine avec cours et devoirs
- 🕐 **Emploi du temps** - Drag & drop pour réorganiser les cours
- 📝 **Gestion des devoirs** - Ajouter, modifier, filtrer, rechercher
- 🎨 **Matières personnalisables** - Ajouter/modifier/supprimer, couleurs et infos des profs
- 🔔 **Alertes Discord** - Rappels automatiques pour les devoirs non faits
- 📱 **Responsive** - Fonctionne sur téléphone, tablette et PC
- 🌙 **3 thèmes** - Sombre, Clair, Océan
- 💾 **Sauvegarde locale** - Tes données restent sur ton appareil
- 🔄 **Synchronisation JSON** - Partage tes données entre appareils via GitHub
- 📲 **PWA** - Installable sur ton téléphone comme une app

## 🚀 Déploiement sur GitHub Pages

### Option 1 : Avec GitHub Desktop (facile)

1. Télécharge [GitHub Desktop](https://desktop.github.com/)
2. Crée un nouveau repo ou utilise `vivaeur08/school-planner`
3. Ajoute les fichiers de ce dossier
4. Commit et push
5. Va dans **Settings > Pages** du repo
6. Sélectionne la branche `main` et le dossier `/ (racine)`
7. Ton site sera sur `https://vivaeur08.github.io/school-planner/`

### Option 2 : Avec git en ligne de commande

```bash
cd school-planner
git init
git add .
git commit -m "Refonte SchoolPlanner - nouvelle palette de couleurs"
git branch -M main
git remote add origin https://github.com/vivaeur08/school-planner.git
git push -u origin main
```

Puis dans GitHub : **Settings > Pages** → branche `main` → dossier `/` → Save

### Option 3 : Script de déploiement

```bash
chmod +x deploy.sh
./deploy.sh
```

## 🔄 Synchronisation entre appareils

### Comment ça marche

1. **Sur ton PC** : tu modifies tes devoirs/cours → **Paramètres > Exporter pour GitHub** → télécharge `homework.json`
2. **Pousse le fichier sur GitHub** (commit + push)
3. **Sur ton téléphone** : ouvre le site → **Paramètres > Synchroniser depuis JSON** → tes données sont à jour !
4. **Inversement** : modifie sur ton téléphone → exporte → pousse sur GitHub → synchronise sur ton PC

### Astuce : synchronisation automatique

Le site charge automatiquement `data/homework.json` à la première visite. Si tu mets à jour ce fichier sur GitHub, les nouveaux appareils auront les dernières données.

## 📁 Structure du fichier JSON

```json
{
    "subjects": [
        { "id": "s1", "name": "VENTE & DEV. COMMER.", "teacher": "MARTIN N.", "room": "F 301", "color": "#f43f5e" }
    ],
    "schedule": {
        "lundi": [null, {"subjectId": "s1"}, ...],
        ...
    },
    "homework": [
        { "id": "hw_1", "subjectId": "s1", "title": "Exercices", "date": "2026-09-14", "priority": "medium", "type": "homework", "done": false }
    ]
}
```

## 🔔 Alertes Discord

1. Va dans les **paramètres** de ton salon Discord
2. Clique sur **Intégrations** → **Créer un webhook**
3. Copie l'URL du webhook
4. Colle-la dans **Alertes Discord** dans l'app
5. Choisis l'heure de rappel et le nombre de jours avant
6. Active les alertes !

⚠️ **Important** : les alertes Discord fonctionnent quand l'app est ouverte sur au moins un appareil (PC ou téléphone). L'app vérifie chaque minute si c'est l'heure du rappel.

## 💡 Astuces

- **Ctrl+N** : Ajouter rapidement un devoir
- **Escape** : Fermer une fenêtre modale
- **Sur téléphone** : "Ajouter à l'écran d'accueil" pour installer l'app
- Les données sont sauvegardées automatiquement dans le navigateur

## 🔧 Technologies

- HTML5 / CSS3 / JavaScript (Vanilla - zéro dépendance, charge ultra rapide)
- LocalStorage pour la persistance
- Fetch API pour le chargement JSON
- Discord Webhooks pour les alertes
- PWA (Progressive Web App) avec Service Worker