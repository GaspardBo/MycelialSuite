import usb.core
import usb.util

VENDOR_ID  = 0x28E9
PRODUCT_ID = 0x0289

INIT = b'\x1b\x40'
CUT  = b'\x1d\x56\x00'

def get_printer_endpoint():
    printer = usb.core.find(idVendor=VENDOR_ID, idProduct=PRODUCT_ID)
    if printer is None:
        raise ValueError("Printer not found")

    if printer.is_kernel_driver_active(0):
        try:
            printer.detach_kernel_driver(0)
        except Exception:
            pass

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
        raise ValueError("Could not find OUT endpoint")

    return ep
