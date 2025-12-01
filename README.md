# Mycelial Suite
Web application running on Raspberry Pi with a suite of household tools including shopping list management and thermal-printer support.

This project uses:

- **Flask** as the web framework  
- **Nginx** as a reverse proxy
- A **USB ESC/POS thermal printer** controlled through Python

Connect at http://192.168.0.204/

after making changes reload with:
```bash
sudo systemctl restart mycelialsuite
```

Secret key for flash must be set as an environment variable using:
```bash
export FLASK_SECRET_KEY="your-very-long-random-string"
```