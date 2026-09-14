#!/bin/bash
# ============================================================
# DEPLOY.SH - Déploiement SchoolPlanner sur GitHub Pages
# ============================================================
# Usage : ./deploy.sh
# Pousse les fichiers vers https://github.com/vivaeur08/school-planner.git
# Site : https://vivaeur08.github.io/school-planner/
# ============================================================

set -e

echo "🚀 Déploiement de SchoolPlanner sur GitHub Pages..."
echo ""

# 1. Vérifier que git est installé
if ! command -v git &> /dev/null; then
    echo "❌ Git n'est pas installé."
    echo "   Installe-le avec : sudo apt install git"
    exit 1
fi

# 2. Initialiser le repo si nécessaire
if [ ! -d ".git" ]; then
    echo "📦 Initialisation du dépôt git..."
    git init
    git remote add origin https://github.com/vivaeur08/school-planner.git
else
    echo "📦 Dépôt git existant, mise à jour de l'origine..."
    git remote set-url origin https://github.com/vivaeur08/school-planner.git
fi

# 3. Ajouter tous les fichiers
echo "📝 Ajout des fichiers..."
git add .

# 4. Commit
echo "💾 Commit des changements..."
git commit -m "🚀 Mise à jour SchoolPlanner - $(date '+%d/%m/%Y %H:%M')" || echo "   (rien à commiter)"

# 5. Push
echo "📤 Envoi vers GitHub..."
git branch -M main
git push -u origin main

echo ""
echo "✅ Déploiement terminé !"
echo "🌐 Ton site est disponible sur : https://vivaeur08.github.io/school-planner/"
echo ""
echo "💡 N'oublie pas d'activer GitHub Pages :"
echo "   GitHub > Repo > Settings > Pages > Branch: main / (root) > Save"