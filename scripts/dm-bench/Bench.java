import com.google.zxing.BinaryBitmap;
import com.google.zxing.Binarizer;
import com.google.zxing.DecodeHintType;
import com.google.zxing.LuminanceSource;
import com.google.zxing.PlanarYUVLuminanceSource;
import com.google.zxing.Result;
import com.google.zxing.ResultPoint;
import com.google.zxing.common.GlobalHistogramBinarizer;
import com.google.zxing.common.HybridBinarizer;
import com.google.zxing.datamatrix.DataMatrixReader;
import com.google.zxing.qrcode.QRCodeReader;

import javax.imageio.ImageIO;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.DataInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * ZXing 보조 판독 벤치. 앱이 저장한 프레임 덤프(PGM, 센서 좌표 Y 평면)나 사진(PNG/JPG)으로
 * 크롭 위치·크기·배율·반전·이진화기 조합을 돌려 "읽히는가, 몇 ms인가"를 표로 낸다.
 *
 *   run.sh center <img> [scale...]         프레임 중심 정사각 크롭을 크기별로 (앱의 가운데 크롭 방식)
 *   run.sh grid <img> <cx> <cy> [size]     (cx,cy) 주변 50px 격자로 크롭 중심을 옮기며 성공 지도
 *   run.sh locate <img> [scale...]         질감(블록 분산) 로케이터 → 후보 주변 3×3 지터로 ZXing
 *
 * scale은 짧은 변 기준 배율(1.0 = 입력 그대로). 사진은 보통 폰 프레임보다 크므로 0.48 같은 값으로 1080p를 흉내 낸다.
 * 계획: docs/PLAN_SCAN_RECOGNITION.md 0·3단계
 */
public class Bench {
  static final boolean[] INVERT_ORDER = { true, false }; // 반전 → 정상 (명판은 반전이 먼저 읽힌다)

  public static void main(String[] args) throws Exception {
    if (args.length < 2) {
      System.err.println("usage: Bench center|grid|locate <image> [...]");
      System.exit(2);
    }
    Gray img = load(new File(args[1]));
    switch (args[0]) {
      case "center": center(img, scales(args, 2)); break;
      case "grid": grid(img, Integer.parseInt(args[2]), Integer.parseInt(args[3]), args.length > 4 ? Integer.parseInt(args[4]) : 500); break;
      case "locate": locate(img, scales(args, 2)); break;
      default: System.err.println("unknown mode " + args[0]); System.exit(2);
    }
  }

  static double[] scales(String[] args, int from) {
    if (args.length <= from) return new double[] { 1.0, 0.72, 0.48 };
    double[] out = new double[args.length - from];
    for (int i = from; i < args.length; i++) out[i - from] = Double.parseDouble(args[i]);
    return out;
  }

  // ---- 모드

  static void center(Gray src, double[] scales) {
    for (double scale : scales) {
      Gray img = src.scaled(scale);
      StringBuilder sb = new StringBuilder(String.format("short=%d: ", Math.min(img.w, img.h)));
      for (int side : new int[] { 200, 300, 400, 500, 600, 800, 1000, 1350 }) {
        int s = (int) (side * scale);
        if (s > Math.min(img.w, img.h)) continue;
        Timed t = decodeAt(img, img.w / 2, img.h / 2, s);
        sb.append(String.format("%dpx=%s(%.0fms) ", s, t.result == null ? "x" : "OK", t.ms));
      }
      System.out.println(sb);
    }
  }

  static void grid(Gray img, int cx, int cy, int size) {
    System.out.printf("크롭 %dpx, 중심 (%d±200, %d±200) 50px 격자, O=성공%n", size, cx, cy);
    for (int y = cy - 200; y <= cy + 200; y += 50) {
      StringBuilder sb = new StringBuilder(String.format("y=%5d ", y));
      for (int x = cx - 200; x <= cx + 200; x += 50) {
        Timed t = decodeAt(img, x, y, size);
        sb.append(t.result == null ? "." : "O");
        if (t.result != null && t.points != null && sb.indexOf("→") < 0) {
          sb.append("  → ").append(t.result).append(" 꼭짓점 ");
          for (ResultPoint p : t.points) if (p != null) sb.append(String.format("(%.0f,%.0f) ", p.getX() + t.left, p.getY() + t.top));
        }
      }
      System.out.println(sb);
    }
  }

  /** 질감 로케이터: 가운데 60%를 B×B 블록 분산으로 훑어 상위 후보 3개, 후보마다 ±B 3×3 지터로 ZXing */
  static void locate(Gray src, double[] scales) {
    for (double scale : scales) {
      Gray img = src.scaled(scale);
      int shortSide = Math.min(img.w, img.h);
      int B = Math.max(16, shortSide / 36); // 1080p에서 30px ≈ 기대 코드 폭(약 90px)의 1/3
      int side = (int) (shortSide * 0.6), left = (img.w - side) / 2, top = (img.h - side) / 2;
      long t0 = System.nanoTime();
      int nb = side / B;
      double[] var = new double[nb * nb];
      for (int by = 0; by < nb; by++) {
        for (int bx = 0; bx < nb; bx++) {
          long s = 0, ss = 0;
          for (int y = 0; y < B; y++) {
            int row = (top + by * B + y) * img.w + left + bx * B;
            for (int x = 0; x < B; x++) { int v = img.y[row + x] & 0xFF; s += v; ss += (long) v * v; }
          }
          double m = (double) s / (B * B);
          var[by * nb + bx] = (double) ss / (B * B) - m * m;
        }
      }
      double[] agg = new double[nb * nb];
      Integer[] idx = new Integer[nb * nb];
      for (int by = 0; by < nb; by++) for (int bx = 0; bx < nb; bx++) {
        double t = 0;
        for (int dy = -1; dy <= 1; dy++) for (int dx = -1; dx <= 1; dx++) {
          int yy = by + dy, xx = bx + dx;
          if (yy >= 0 && yy < nb && xx >= 0 && xx < nb) t += var[yy * nb + xx];
        }
        agg[by * nb + bx] = t; idx[by * nb + bx] = by * nb + bx;
      }
      Arrays.sort(idx, (p, q) -> Double.compare(agg[q], agg[p]));
      List<int[]> cands = new ArrayList<>();
      for (Integer i : idx) {
        int bx0 = i % nb, by0 = i / nb;
        double sw = 0, sx = 0, sy = 0; // 5×5 가중 무게중심
        for (int dy = -2; dy <= 2; dy++) for (int dx = -2; dx <= 2; dx++) {
          int yy = by0 + dy, xx = bx0 + dx;
          if (yy < 0 || yy >= nb || xx < 0 || xx >= nb) continue;
          double w = var[yy * nb + xx]; sw += w; sx += w * xx; sy += w * yy;
        }
        int cx = left + (int) (sx / sw * B) + B / 2, cy = top + (int) (sy / sw * B) + B / 2;
        boolean near = false;
        for (int[] c : cands) if (Math.abs(c[0] - cx) < B * 3 && Math.abs(c[1] - cy) < B * 3) near = true;
        if (!near) cands.add(new int[] { cx, cy });
        if (cands.size() == 3) break;
      }
      double locMs = (System.nanoTime() - t0) / 1e6;

      int tries = 0; String found = null; double zxMs = 0; int rank = 0;
      outer:
      for (int[] c : cands) {
        rank++;
        for (int jy = -1; jy <= 1; jy++) for (int jx = -1; jx <= 1; jx++) {
          tries++;
          Timed t = decodeAt(img, c[0] + jx * B, c[1] + jy * B, (int) (500 * scale));
          zxMs += t.ms;
          if (t.result != null) {
            found = String.format("후보#%d 지터(%+d,%+d) %d회째 → %s", rank, jx, jy, tries, t.result);
            break outer;
          }
        }
      }
      System.out.printf("short=%d 블록=%d 로케이터 %.1fms | %s | ZXing %.1fms%n",
          shortSide, B, locMs, found == null ? tries + "회 모두 실패" : found, zxMs);
    }
  }

  // ---- 판독

  static final class Timed { String result; ResultPoint[] points; double ms; int left, top; }

  /** (cx,cy) 중심 side 정사각 크롭을 반전→정상, Hybrid→GlobalHistogram 순으로 DM·QR 판독 */
  static Timed decodeAt(Gray img, int cx, int cy, int side) {
    Timed out = new Timed();
    side = Math.min(side, Math.min(img.w, img.h));
    int left = Math.max(0, Math.min(img.w - side, cx - side / 2));
    int top = Math.max(0, Math.min(img.h - side, cy - side / 2));
    out.left = left; out.top = top;
    byte[] lum = new byte[side * side];
    for (int y = 0; y < side; y++) System.arraycopy(img.y, (top + y) * img.w + left, lum, y * side, side);
    LuminanceSource base = new PlanarYUVLuminanceSource(lum, side, side, 0, 0, side, side, false);
    Map<DecodeHintType, Object> hints = new EnumMap<>(DecodeHintType.class);
    hints.put(DecodeHintType.TRY_HARDER, Boolean.TRUE);
    long t0 = System.nanoTime();
    for (boolean invert : INVERT_ORDER) {
      LuminanceSource src = invert ? base.invert() : base;
      for (Binarizer b : new Binarizer[] { new HybridBinarizer(src), new GlobalHistogramBinarizer(src) }) {
        BinaryBitmap bmp = new BinaryBitmap(b);
        try { Result r = new DataMatrixReader().decode(bmp, hints); out.result = r.getText(); out.points = r.getResultPoints(); } catch (Exception ignored) { }
        if (out.result == null) try { Result r = new QRCodeReader().decode(bmp, hints); out.result = r.getText(); out.points = r.getResultPoints(); } catch (Exception ignored) { }
        if (out.result != null) { out.ms = (System.nanoTime() - t0) / 1e6; return out; }
      }
    }
    out.ms = (System.nanoTime() - t0) / 1e6;
    return out;
  }

  // ---- 입력

  static final class Gray {
    final int w, h; final byte[] y;
    Gray(int w, int h, byte[] y) { this.w = w; this.h = h; this.y = y; }
    Gray scaled(double scale) {
      if (scale == 1.0) return this;
      BufferedImage src = new BufferedImage(w, h, BufferedImage.TYPE_BYTE_GRAY);
      src.getRaster().setDataElements(0, 0, w, h, y);
      int nw = (int) (w * scale), nh = (int) (h * scale);
      BufferedImage dst = new BufferedImage(nw, nh, BufferedImage.TYPE_BYTE_GRAY);
      Graphics2D g = dst.createGraphics();
      g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
      g.drawImage(src, 0, 0, nw, nh, null); g.dispose();
      return new Gray(nw, nh, ((java.awt.image.DataBufferByte) dst.getRaster().getDataBuffer()).getData());
    }
  }

  /** PGM(P5, 앱 프레임 덤프) 또는 ImageIO가 읽는 사진 */
  static Gray load(File f) throws IOException {
    if (f.getName().endsWith(".pgm")) {
      try (DataInputStream in = new DataInputStream(new java.io.BufferedInputStream(new FileInputStream(f)))) {
        String magic = token(in); int w = Integer.parseInt(token(in)); int h = Integer.parseInt(token(in)); token(in); // maxval
        if (!magic.equals("P5")) throw new IOException("P5 PGM만 지원: " + magic);
        byte[] y = new byte[w * h]; in.readFully(y);
        return new Gray(w, h, y);
      }
    }
    BufferedImage src = ImageIO.read(f);
    if (src == null) throw new IOException("읽을 수 없는 이미지: " + f);
    BufferedImage gray = new BufferedImage(src.getWidth(), src.getHeight(), BufferedImage.TYPE_BYTE_GRAY);
    gray.getGraphics().drawImage(src, 0, 0, null);
    return new Gray(gray.getWidth(), gray.getHeight(), ((java.awt.image.DataBufferByte) gray.getRaster().getDataBuffer()).getData());
  }

  static String token(DataInputStream in) throws IOException {
    StringBuilder sb = new StringBuilder(); int c;
    while ((c = in.read()) != -1) {
      if (c == '#') { while (c != '\n' && c != -1) c = in.read(); continue; }
      if (Character.isWhitespace(c)) { if (sb.length() > 0) break; continue; }
      sb.append((char) c);
    }
    return sb.toString();
  }
}
