import usb.core
import usb.util
from PIL import Image
import threading

# --------------------------
#  PRINTER CONFIG
# --------------------------
VENDOR_ID  = 0x28E9
PRODUCT_ID = 0x0289

# ESC/POS commands
INIT = b'\x1b\x40'
TEST_TXT = b'Love from Throbbert <3\n'
CUT  = b'\x1d\x56\x00'

# THREAD LOCK to prevent concurrent USB access
usb_lock = threading.Lock()

# --------------------------
#  USB WRITE HELPERS
# --------------------------
def get_printer_endpoint():
    printer = usb.core.find(idVendor=VENDOR_ID, idProduct=PRODUCT_ID)
    if printer is None:
        raise ValueError("Printer not found!")

    # Detach kernel driver (Linux) 
    if printer.is_kernel_driver_active(0): 
        printer.detach_kernel_driver(0)

    printer.set_configuration()
    cfg = printer.get_active_configuration()
    intf = cfg[(0, 0)]

    ep = usb.util.find_descriptor(
        intf,
        custom_match=lambda e:
            usb.util.endpoint_direction(e.bEndpointAddress)
            == usb.util.ENDPOINT_OUT
    )
    if ep is None:
        raise ValueError("Could not find OUT endpoint.")

    return ep


# --------------------------
#  IMAGE HELPERS
# --------------------------
def convert_image_to_raster(image, max_width=384):

    # Load
    img = Image.open(image)

    # Convert to grayscale first
    img = img.convert("L")

    # Resize to printer width
    w_percent = max_width / float(img.size[0])
    new_height = int(img.size[1] * w_percent)
    img = img.resize((max_width, new_height), Image.LANCZOS)

    # Apply Floyd–Steinberg dithering → 1-bit image
    img = img.convert("1", dither=Image.FLOYDSTEINBERG)

    width_bytes = max_width // 8
    height = img.height

    pixels = img.load()

    raster = bytearray()

    # ESC/POS Raster Format: GS v 0
    raster += b'\x1d\x76\x30\x00'
    raster += bytes([width_bytes & 0xFF, (width_bytes >> 8) & 0xFF])
    raster += bytes([height & 0xFF, (height >> 8) & 0xFF])

    # Pack 8 pixels per byte
    for y in range(height):
        for x in range(width_bytes):
            byte = 0
            for bit in range(8):
                pixel = pixels[x * 8 + bit, y]
                if pixel == 0:  # black
                    byte |= 1 << (7 - bit)
            raster.append(byte)

    return bytes(raster)

# --------------------------
#  PRINT FUNCTIONS
# --------------------------

def test_print():
    ep = get_printer_endpoint()

    ep.write(INIT)
    ep.write(b"\n")
    ep.write(TEST_TXT)
    ep.write(b"\n")
    ep.write(CUT)

def print_image(image):
    with usb_lock:  # ← prevents simultaneous prints!
        ep = get_printer_endpoint()

        ep.write(INIT)
        ep.write(b"\n")

        raster = convert_image_to_raster(image)

        CHUNK = 4096
        for i in range(0, len(raster), CHUNK):
            ep.write(raster[i:i+CHUNK])

        ep.write(b"\n")
        ep.write(CUT)

        print("Image printed!")


if __name__ == "__main__":
    test_print()