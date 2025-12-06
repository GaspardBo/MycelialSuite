import threading
import queue
from .printer import get_printer_endpoint, INIT, CUT
from .utils import convert_to_printer_raster

print_queue = queue.Queue()


def worker():
    while True:
        img = print_queue.get()
        try:
            do_print(img)
        except Exception as e:
            print(f"[PRINT ERROR] {e}")
        finally:
            print_queue.task_done()


def do_print(image):
    ep = get_printer_endpoint()

    ep.write(INIT)
    ep.write(b"\n")

    raster = convert_to_printer_raster(image)

    CHUNK = 4096
    for i in range(0, len(raster), CHUNK):
        ep.write(raster[i:i+CHUNK])

    ep.write(b"\n")
    ep.write(CUT)

    print("Print job done!")


# Start worker thread immediately
thread = threading.Thread(target=worker, daemon=True)
thread.start()
