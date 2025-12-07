const fileInput = document.getElementById("imageInput");
const canvas = document.getElementById("previewCanvas");
const ctx = canvas.getContext("2d");

const brightnessSlider = document.getElementById("brightness");
const contrastSlider = document.getElementById("contrast");
const rotateButton = document.getElementById("rotateButton");
const restoreButton = document.getElementById("restoreButton");
const printButton = document.getElementById("printButton");

let originalGrayData = null;           // grayscale after first upload
let originalGrayDataUnrotated = null;  // keeps the original orientation
let width = 0;
let height = 0;

// Apply brightness + contrast on top of grayscale
function applyAdjustments() {
    if (!originalGrayData) return;

    const imageData = ctx.createImageData(width, height);
    const dst = imageData.data;
    const src = originalGrayData.data;

    const brightness = parseInt(brightnessSlider.value);
    const contrast = parseInt(contrastSlider.value);

    const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));

    for (let i = 0; i < src.length; i += 4) {
        let value = src[i];

        // apply contrast
        value = contrastFactor * (value - 128) + 128;

        // apply brightness
        value += brightness;

        // clamp
        value = Math.min(255, Math.max(0, value));

        dst[i] = dst[i + 1] = dst[i + 2] = value;
        dst[i + 3] = 255;
    }

    ctx.putImageData(imageData, 0, 0);
}

// Load image → convert to grayscale → save original pixels
fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {

            width = img.width;
            height = img.height;

            canvas.width = width;
            canvas.height = height;

            ctx.drawImage(img, 0, 0);

            const imgData = ctx.getImageData(0, 0, width, height);
            const data = imgData.data;

            // convert to grayscale
            for (let i = 0; i < data.length; i += 4) {
                const gray =
                    0.299 * data[i] +
                    0.587 * data[i + 1] +
                    0.114 * data[i + 2];

                data[i] = data[i + 1] = data[i + 2] = gray;
            }

            originalGrayData = new ImageData(new Uint8ClampedArray(imgData.data), width, height);
            originalGrayDataUnrotated = new ImageData(new Uint8ClampedArray(imgData.data), width, height);

            ctx.putImageData(originalGrayData, 0, 0);
        };

        img.src = e.target.result;
    };

    reader.readAsDataURL(file);
});

// Brightness + contrast live updates
brightnessSlider.addEventListener("input", applyAdjustments);
contrastSlider.addEventListener("input", applyAdjustments);

// Fix: rotate ORIGINAL grayscale, not already-adjusted image
rotateButton.addEventListener("click", () => {
    if (!originalGrayData) return;

    // temp canvas for rotation
    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");

    tempCanvas.width = height;
    tempCanvas.height = width;

    // draw the ORIGINAL grayscale to a helper canvas
    const originalCanvas = document.createElement("canvas");
    originalCanvas.width = width;
    originalCanvas.height = height;
    originalCanvas.getContext("2d").putImageData(originalGrayData, 0, 0);

    // rotate 90 degrees clockwise
    tempCtx.save();
    tempCtx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
    tempCtx.rotate(- Math.PI / 2);
    tempCtx.drawImage(originalCanvas, -width / 2, -height / 2);
    tempCtx.restore();

    // update main canvas size
    width = tempCanvas.width;
    height = tempCanvas.height;

    canvas.width = width;
    canvas.height = height;

    // save rotated grayscale
    originalGrayData = tempCtx.getImageData(0, 0, width, height);

    // reapply brightness/contrast to the new rotated grayscale
    applyAdjustments();
});

restoreButton.addEventListener("click", () => {
    if (!originalGrayDataUnrotated) return;

    // Reset sliders
    brightnessSlider.value = 0;
    contrastSlider.value = 0;

    // Restore original orientation and size
    width = originalGrayDataUnrotated.width;
    height = originalGrayDataUnrotated.height;
    canvas.width = width;
    canvas.height = height;

    // Restore the original grayscale image
    originalGrayData = new ImageData(
        new Uint8ClampedArray(originalGrayDataUnrotated.data),
        width,
        height
    );

    ctx.putImageData(originalGrayData, 0, 0);
});


// Print sends the edited (visible) canvas
printButton.addEventListener("click", () => {
    if (!originalGrayData) {
        const flashList = document.getElementById("flashMessages");
        const li = document.createElement("li");
        li.textContent = "No image uploaded.";
        li.style.color = "red";
        flashList.appendChild(li);
        return; // stop
    }

    // show "Printing..." and send
    const flashList = document.getElementById("flashMessages");
    const printingItem = document.createElement("li");
    printingItem.textContent = "Printing...";
    printingItem.style.color = "blue";
    flashList.appendChild(printingItem);

    canvas.toBlob((blob) => {
        const formData = new FormData();
        formData.append("image", blob, "edited.png");

        fetch(UPLOAD_URL, { method: "POST", body: formData })
            .then(() => window.location.reload())
            .catch(() => window.location.reload());
    });
});
