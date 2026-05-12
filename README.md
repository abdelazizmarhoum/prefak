# PREFAK — Suite ERP Logistique & Commerciale

PREFAK est une application de bureau robuste conçue pour la gestion complète de la chaîne logistique, de la production et du cycle commercial. Développée avec **Electron**, **SQLite** et des technologies web modernes, elle offre une expérience fluide, performante et sécurisée.

## 🚀 Fonctionnalités Principales

### 📦 Gestion de l'Inventaire (Logistique)
- **Matériaux :** Suivi complet des matières premières avec gestion des unités, prix unitaires et images.
- **Seuils d'Alerte :** Indicateurs visuels pour les stocks critiques.
- **Mouvements de Stock :** Traçabilité totale des entrées (IN), sorties (OUT) et ajustements.
- **Écosystème QR :** Génération de codes QR imprimables pour chaque matériau et scanner intégré pour des opérations instantanées.

### 🏗️ Production Industrielle
- **Suivi de Fabrication :** Enregistrement des sessions de production (ex: Maisons Modèles).
- **Déstockage Automatique :** La création d'une production déduit automatiquement les matières premières consommées du stock réel.
- **Détails Précis :** Consultation des recettes et des matériaux utilisés pour chaque lot produit.

### 👥 Commercial & Ventes
- **Base Clients :** Gestion centralisée des coordonnées et de l'historique d'achat des clients.
- **Cycle de Vente :** Suivi des ventes (Payées, En attente, Annulées).
- **Facturation PDF :** Génération instantanée de factures professionnelles prêtes à l'envoi.

### 📈 Finance & Analytics
- **Gestion des Dépenses :** Journalisation des charges fixes (loyer, salaires, énergie) par catégorie.
- **Tableau de Bord Financier :** Calcul automatique du **Chiffre d'Affaires**, du **COGS** (Coût des produits vendus) et du **Bénéfice Net**.
- **Visualisation de Données :** Graphiques interactifs (Revenus mensuels, structure des coûts, valeur du stock).

### 🛠️ Administration & Export
- **Audit Complet :** Historique détaillé de chaque mouvement de stock pour une conformité totale.
- **Export Multi-format :** Exportation en un clic de toutes les listes (Inventaire, Clients, Dépenses, Historique) vers **Excel (XLSX)** et **PDF**.
- **Maintenance :** Chargeur de données de démonstration intégré et personnalisation du chemin de stockage des données.

## 💻 Installation & Développement

### Prérequis
- [Node.js](https://nodejs.org/) (Version LTS recommandée)
- npm (installé avec Node.js)

### Installation
```bash
# Cloner le dépôt
git clone <url-du-depot>

# Installer les dépendances
npm install
```

### Lancement & Build
```bash
# Mode développement
npm start

# Créer l'exécutable (Windows .exe)
npm run package
```

## 🛠️ Stack Technique
- **Runtime :** Electron (Node.js + Chromium)
- **Base de données :** SQLite (via better-sqlite3)
- **Interface :** HTML5, Vanilla CSS (Design Sharp/Excel Style), JavaScript ES6+
- **Bibliothèques :** 
  - Chart.js (Analytics)
  - jsPDF & AutoTable (Rapports PDF)
  - SheetJS / XLSX (Exports Excel)
  - Html5-QRCode (Scanner)

## 🎨 Design System
L'application utilise un design **"Professional Sharp"** inspiré des outils de productivité comme Excel :
- Bordures à angles droits (0px radius) pour une densité d'information maximale.
- Typographie **Inter** pour une lisibilité parfaite.
- Palette de couleurs harmonieuse (Vert émeraude pour la logistique, Bleu pour le commercial, Rouge pour les dépenses).

---
© 2026 PREFAK Logistics — Solution de gestion intégrée.
