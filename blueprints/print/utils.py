from PIL import Image

def convert_to_printer_raster(img: Image.Image) -> bytes:
    img = img.convert("L")        # grayscale
    img = img.point(lambda x: 0 if x < 128 else 255, 'L')  # threshold
    img = img.convert("1")        # pure black/white

    # ESC/POS raster format: GS v 0
    width = (img.width + 7) // 8
    height = img.height

    header = b'\x1d\x76\x30\x00' + \
             bytes([width & 0xFF, (width >> 8) & 0xFF,
                    height & 0xFF, (height >> 8) & 0xFF])

    data = img.tobytes()

    return header + data
