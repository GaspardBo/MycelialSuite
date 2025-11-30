# Micelial Suite
A lightweight, self-hosted web application running on a **Raspberry Pi**, providing a suite of simple household tools — including **shopping list management and thermal-printer support**.

This project uses:

- **Flask** as the web framework  
- **Nginx** (optional) as a reverse proxy for production  
- A **USB ESC/POS thermal printer** controlled through Python  
- A mobile-friendly UI designed for quick household use  

---

## Planned Features

### 🧾 Print to a Thermal Receipt Printer  
- USB ESC/POS printer support  
- Rasterized + dithered image printing  
- Text printing with formatting  
- Designed for Raspberry Pi OS  
- Supports custom icons, headers, QR codes, etc.

### 🛒 Shopping List Tool  
- Create and edit a shared shopping list  
- Save items persistently  
- Print directly from the browser  
- Mobile-friendly (works great on phones)

### 🌐 Internal Web Dashboard  
- Hosted locally on your Pi  
- Accessible from any device on your home network  
- Easily extendable with more household utilities

---

## 📦 Project Structure
mycelialSuite/
│
├── app.py # Flask entry point
├── printer/
│ ├── escpos.py # ESC/POS USB driver
│ └── utils.py # image conversion, dithering, formatting
│
├── static/ # CSS, JS, icons
└── templates/ # HTML templates (Jinja2)

---
