# ☀️ Sunnylink Wiki

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Status: Alpha](https://img.shields.io/badge/Status-Alpha-orange.svg)]()
[![Stack: Next.js 14](https://img.shields.io/badge/Tech-Next.js%2014-black)]()

**The "Missing Manual" for Sunnypilot.** A community-driven database decoding the complex settings, toggles, and driving models of the [sunnypilot](https://github.com/sunnypilot/sunnypilot) ecosystem.

<img width="1448" height="1142" alt="vwEIcgLrhY" src="https://github.com/user-attachments/assets/c4dc3055-df88-4b39-8b28-56a512f5c067" />

### Check it out here: https://vinhle.co/sp

---

## 🚀 Overview

Sunnypilot (a fork of openpilot) offers incredible customization, with over **100+ toggles** and **60+ driving models**. However, for new users, understanding the difference between *"MADS"* and *"NNLC"* or choosing between *"WMI v12"* and *"Recertified Herbalist"* can be overwhelming.

**Sunnylink Database** solves this by acting as the single source of truth. It is a mobile-first web app that translates technical settings into plain English, helping drivers configure their Comma devices with confidence.

### ✨ Key Features

* **🎛️ Toggle Encyclopedia:** A searchable wiki for every setting (MADS, Dynamic Experimental Control, etc.) with definitions, safety warnings, and dependencies.
* **🧠 Model "Vibe Check" Explorer:** A breakdown of driving models not just by version, but by *feel* (e.g., "Aggressive," "Comfort," "Legacy").
* **📱 Mobile-First Design:** Optimized for in-car reference, allowing you to look up settings while sitting in your driver's seat.
* **🔌 Antigravity Ready:** All data is stored in structured JSON, serving as the backend for the Sunnylink "Antigravity" app ecosystem.

---

## 🧠 The Models Page (Model Explorer)
Navigating the dozens of available driving models can be confusing. Names like "WMI v12" or "Dark Souls" don't explain how the car will actually behave. The Models Page solves this by shifting the focus from version numbers to Driving Vibes.

<img width="1348" height="1003" alt="cmhcB6JybV" src="https://github.com/user-attachments/assets/6a0af72a-3feb-42cb-a704-dadf7ac80600" />

Instead of a dry list of files, users are presented with a rich "Model Explorer" that answers the most critical question: "How does it feel to drive?"

### Key Features
✨ The "Vibe Check" System: Every model is tagged with human-readable attributes (e.g., Aggressive, Limo Driver, On Rails, Wife Approved) so you know what to expect before you download.

### 📊 Community Consensus: 
We aggregate real feedback from the Sunnypilot Discord and forums to provide a "Truth Score" for each model.

Example: "WMI v12 is great at intersections but can feel 'loose' on straight highways."

### 🗂️ Smart Categorization: Models are grouped by their architecture and era:

- 2026 World Models: The latest "End-to-End" AI that understands 3D scenes.
- Legacy / Stable: Older, robotic models (like Recertified Herbalist) that are less smart but rock-solid on highways.
- Experimental: "Bleeding edge" builds (like Firehose) for testers.

### 🏎️ Hardware Context: 
Notes on which models perform best on specific vehicle types (e.g., "Best for heavy steering racks" or "Optimized for Hyundai/Kia").

### Data Source
This page is powered by data/models.json, ensuring that as new models are released or community sentiment shifts, the database can be updated instantly via a simple Pull Request.

---

🧙‍♂️ The Setup Wizard
"Like TurboTax for your sunnylink configuration."

![comet_dgWzKlbboj](https://github.com/user-attachments/assets/abbd31e8-ad72-4bbf-8fec-b49e3237f9b1)

Configuring Sunnypilot involves over 100+ variables, from Neural Network Lateral Control to Dynamic Experimental Control. Instead of forcing users to guess what these mean, the Setup Wizard acts as an expert consultant that interviews the driver.

🚀 Why we built this
We intentionally moved away from a "JSON Config Generator" to avoid the risk of corrupting device files or breaking hardware fingerprints. Instead, the Wizard focuses on education and safety.

✨ How it works
Hardware Handshake: Filters settings based on the user's specific device (C3/C3X/C4) and vehicle make (e.g., hiding Hyundai-only toggles for Toyota drivers).

Psychographic Profiling: Asks plain-English questions like "Do you drive like a Limo Driver or a Commuter?" to map vague preferences into concrete settings (e.g., DrivingPersonality: Relaxed, Model: Down To Ride).

The "Build Sheet": Generates a mobile-optimized, interactive checklist. Users mount their phone in the car and toggle settings manually, learning what they are changing and why.

---

## 🛠️ Tech Stack

* **Framework:** [Next.js 14](https://nextjs.org/) (App Router)
* **Styling:** [Tailwind CSS](https://tailwindcss.com/)
* **Data:** Local JSON (No database required for local dev)
* **Icons:** [Lucide React](https://lucide.dev/)

---

## 🏁 Getting Started

This is a standard Next.js project. You can have it running locally in minutes.

### Prerequisites
* Node.js 18+
* npm or yarn

### Installation

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/your-username/sunnylink-database.git](https://github.com/your-username/sunnylink-database.git)
    cd sunnylink-database
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Run the development server:**
    ```bash
    npm run dev
    ```

4.  **Open your browser:**
    Navigate to `http://localhost:3000` to see the wiki live.

---

## 💾 Data Structure

The heart of this project lies in the `data/` directory. We strictly separate content from code to allow non-developers to contribute easily.

### `data/toggles.json`
Stores the definitions for system settings.
```json
{
  "key": "mads_enabled",
  "label": "MADS Enabled",
  "category": "steering",
  "description": "Decouples steering from gas/brake...",
  "safety_level": "safe"
}
data/models.json
Stores the "Vibe Check" data for driving models.

JSON

{
  "name": "WMI V12",
  "tags": ["Flagship", "Smart"],
  "consensus": "Current daily driver. Best for intersections.",
  "vibe": "Modern & Smart"
}
🤝 Contributing
We welcome contributions from the community! Whether you are a React developer or just a driver who wants to fix a typo in a model description.

How to help:
Verify Data: If you see a model description that doesn't match reality, submit a PR to update models.json.

Add Examples: We need more "Real World Scenarios" for the Toggle Wiki.

Code: Check the Issues tab for open tasks.

Please read our CONTRIBUTING.md for details on our code of conduct and submission process.

📄 License
This project is licensed under the MIT License - see the LICENSE file for details.

🙏 Acknowledgments
Sunnyhaibin & the Sunnypilot Team: For building the incredible software this wiki documents.

Comma.ai: For the openpilot platform that started it all.

The Sunnypilot Discord Community: For the endless testing and feedback that powers our "Community Consensus" data.
```

---

### Disclaimer: This whole thing was vibecoded with Antigravity using Gemini 3 Pro & Opus 4.5

<img width="281" height="179" alt="image" src="https://github.com/user-attachments/assets/3998bb44-998e-49c3-b299-0a36498eef5f" />
