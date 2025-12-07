import usb.core
import usb.util
from PIL import Image, ImageOps
from multiprocessing import Process, Queue
import multiprocessing
import os

# --------------------------
#  PRINTER CONFIG
# --------------------------
VENDOR_ID  = 0x28E9
PRODUCT_ID = 0x0289

# ESC/POS commands
INIT = b'\x1b\x40'
TEST_TXT = b'Love from Throbbert <3\n'
CUT  = b'\x1d\x56\x00'

# Image Chunk Height in rows
CHUNK_HEIGHT = 24

# --------------------------
#  PRINT QUEUE
# --------------------------
print_queue = multiprocessing.Queue()
worker_process = None   # global reference

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
# IMAGE HELPERS
# --------------------------

def image_to_escpos_chunks(img: Image.Image, max_width=384, chunk_height=24):
    # Ensure image rotation is correct
    img = ImageOps.exif_transpose(img)

    # Convert to grayscale and dither
    img = img.convert("L")
    w_percent = max_width / float(img.size[0])
    new_height = int(img.size[1] * w_percent)
    img = img.resize((max_width, new_height), Image.LANCZOS)
    img = img.convert("1", dither=Image.FLOYDSTEINBERG)

    width_bytes = max_width // 8
    pixels = img.load()

    # Process in chunks
    for y0 in range(0, img.height, chunk_height):
        h = min(chunk_height, img.height - y0)

        # ESC/POS raster header
        chunk = bytearray()
        chunk += b'\x1d\x76\x30\x00'
        chunk += bytes([width_bytes & 0xFF, (width_bytes >> 8) & 0xFF])
        chunk += bytes([h & 0xFF, (h >> 8) & 0xFF])

        # Pack rows
        for y in range(y0, y0 + h):
            for x in range(width_bytes):
                byte = 0
                for bit in range(8):
                    px = pixels[x * 8 + bit, y]
                    if px == 0:  # black pixel
                        byte |= 1 << (7 - bit)
                chunk.append(byte)

        yield bytes(chunk)

# --------------------------
# PRINT JOB FUNCTIONS
# --------------------------
def print_text(text: str):
    print_queue.put({"type": "text", "data": text})

def print_image(image: Image.Image):
    #print("[DEBUG] Queuing image for print")
    print_queue.put({"type": "image", "image": image})

def test_print():
    print_queue.put({"type": "text", "data": "Love from Throbbert <3\n"})

# --------------------------
# PRINT WORKER FOR ASYNC PRINTING
# --------------------------

def printer_worker(q: Queue):
    ep = None

    while True:
        job = q.get()  # blocks until new job arrives
        
        if job is None:   # sentinel for clean shutdown
            break

        try:
            if ep is None:
                ep = get_printer_endpoint()
            
            if job["type"] == "text":
                ep.write(INIT)
                ep.write(job["data"].encode("utf-8"))
                ep.write(b"\n")
                ep.write(CUT)

            elif job["type"] == "image":
                ep.write(INIT)
                
                img = job["image"]
                
                for raster_chunk in image_to_escpos_chunks(img):
                    ep.write(raster_chunk)

                ep.write(b"\n")
                ep.write(CUT)

        except Exception as e:
            print(f"[Worker] Printer error: {e}")
            ep = None  # force reconnect next loop

# ---------- Module-level flag ----------
_worker_started = False

def start_worker():
    global worker_process, _worker_started
    print("[DEBUG] start_worker() called")
    from multiprocessing import Process
    if not _worker_started:
        worker_process = Process(target=printer_worker, args=(print_queue,), daemon=True)
        worker_process.start()
        _worker_started = True
        print(f"[INFO] Printer worker started in PID {os.getpid()}")

def stop_worker():
    global worker_process
    if worker_process and worker_process.is_alive():
        print_queue.put(None)  # send sentinel to stop worker loop
        worker_process.join(timeout=5)
        worker_process = None


if __name__ == "__main__":
    print("Running printer module in standalone test mode...")

    # IMPORTANT: Required on Windows/macOS for multiprocessing
    multiprocessing.freeze_support()

    start_worker()

    # Test print
    test_print()

    # Wait a moment so the worker has time to run
    import time
    time.sleep(2)

    stop_worker()