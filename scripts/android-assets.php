<?php
/**
 * Generator aset native Android — Pitou Cafe POS (Fase 17).
 *
 * Menghasilkan (dari brand yang sama dengan ikon PWA Fase 15):
 * - mipmap ic_launcher / ic_launcher_round / ic_launcher_foreground
 *   untuk seluruh densitas (mdpi…xxxhdpi) → adaptive + round icon.
 * - splash.png (drawable, serta drawable-port dan drawable-land).
 *
 * Deterministik & offline (PHP GD), tanpa tooling tambahan.
 * Warna primary #0A45FE, huruf "P" putih (identitas Pitou Cafe).
 */

$res = __DIR__ . '/../android/app/src/main/res';
$font = 'C:/Windows/Fonts/arialbd.ttf';

if (! is_dir($res)) {
    fwrite(STDERR, "Folder res Android tidak ditemukan: $res\n");
    exit(1);
}
if (! file_exists($font)) {
    fwrite(STDERR, "Font tidak ditemukan: $font\n");
    exit(1);
}

[$pr, $pg, $pb] = [0x0A, 0x45, 0xFE]; // primary #0A45FE

function newCanvas(int $w, int $h): \GdImage
{
    $img = imagecreatetruecolor($w, $h);
    imagesavealpha($img, true);
    imagefill($img, 0, 0, imagecolorallocatealpha($img, 0, 0, 0, 127));
    return $img;
}

function drawLetterP(\GdImage $img, int $size, float $ratio, int $cx, int $cy, string $font): void
{
    $white = imagecolorallocate($img, 255, 255, 255);
    $fontSize = $size * $ratio;
    $bbox = imagettfbbox($fontSize, 0, $font, 'P');
    $textW = abs($bbox[4] - $bbox[0]);
    $textH = abs($bbox[5] - $bbox[1]);
    $x = (int) ($cx - $textW / 2 - $bbox[0]);
    $y = (int) ($cy + $textH / 2);
    imagettftext($img, $fontSize, 0, $x, $y, $white, $font, 'P');
}

function save(\GdImage $img, string $path): void
{
    if (! is_dir(dirname($path))) {
        mkdir(dirname($path), 0777, true);
    }
    imagepng($img, $path, 9);
    imagedestroy($img);
    echo 'OK ' . str_replace('\\', '/', $path) . "\n";
}

// ---- Ikon launcher legacy (rounded-rect) ----
function makeLauncher(int $size, int $pr, int $pg, int $pb, string $font): \GdImage
{
    $img = newCanvas($size, $size);
    $primary = imagecolorallocate($img, $pr, $pg, $pb);
    $r = (int) ($size * 0.20);
    imagefilledrectangle($img, $r, 0, $size - $r, $size, $primary);
    imagefilledrectangle($img, 0, $r, $size, $size - $r, $primary);
    foreach ([[$r, $r], [$size - $r, $r], [$r, $size - $r], [$size - $r, $size - $r]] as [$ex, $ey]) {
        imagefilledellipse($img, $ex, $ey, $r * 2, $r * 2, $primary);
    }
    drawLetterP($img, $size, 0.56, (int) ($size / 2), (int) ($size / 2), $font);
    return $img;
}

// ---- Ikon round ----
function makeRound(int $size, int $pr, int $pg, int $pb, string $font): \GdImage
{
    $img = newCanvas($size, $size);
    $primary = imagecolorallocate($img, $pr, $pg, $pb);
    imagefilledellipse($img, (int) ($size / 2), (int) ($size / 2), $size, $size, $primary);
    drawLetterP($img, $size, 0.52, (int) ($size / 2), (int) ($size / 2), $font);
    return $img;
}

// ---- Foreground adaptive (transparan, P di safe zone 66%) ----
function makeForeground(int $size, string $font): \GdImage
{
    $img = newCanvas($size, $size);
    // Safe zone adaptive ≈ 66% tengah → huruf lebih kecil
    drawLetterP($img, $size, 0.40, (int) ($size / 2), (int) ($size / 2), $font);
    return $img;
}

// Densitas mipmap: [dir => [launcherSize, foregroundSize]]
$densities = [
    'mdpi' => [48, 108],
    'hdpi' => [72, 162],
    'xhdpi' => [96, 216],
    'xxhdpi' => [144, 324],
    'xxxhdpi' => [192, 432],
];

foreach ($densities as $dpi => [$icon, $fg]) {
    $dir = "$res/mipmap-$dpi";
    save(makeLauncher($icon, $pr, $pg, $pb, $font), "$dir/ic_launcher.png");
    save(makeRound($icon, $pr, $pg, $pb, $font), "$dir/ic_launcher_round.png");
    save(makeForeground($fg, $font), "$dir/ic_launcher_foreground.png");
}

// ---- Splash (logo putih di atas primary) ----
function makeSplash(int $w, int $h, int $pr, int $pg, int $pb, string $font): \GdImage
{
    $img = imagecreatetruecolor($w, $h);
    imagefilledrectangle($img, 0, 0, $w, $h, imagecolorallocate($img, $pr, $pg, $pb));
    $logo = (int) (min($w, $h) * 0.28);
    drawLetterP($img, $logo, 1.0, (int) ($w / 2), (int) ($h / 2), $font);
    return $img;
}

$splashPort = [
    'drawable-port-mdpi' => [320, 480],
    'drawable-port-hdpi' => [480, 800],
    'drawable-port-xhdpi' => [720, 1280],
    'drawable-port-xxhdpi' => [960, 1600],
    'drawable-port-xxxhdpi' => [1280, 1920],
];

foreach ($splashPort as $dir => [$w, $h]) {
    save(makeSplash($w, $h, $pr, $pg, $pb, $font), "$res/$dir/splash.png");
    // Landscape = dimensi ditukar
    $landDir = str_replace('-port-', '-land-', $dir);
    save(makeSplash($h, $w, $pr, $pg, $pb, $font), "$res/$landDir/splash.png");
}

// Splash generik dipakai Theme.SplashScreen (@drawable/splash)
save(makeSplash(1080, 1920, $pr, $pg, $pb, $font), "$res/drawable/splash.png");

echo "Selesai membuat aset Android.\n";
