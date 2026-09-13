# WF-IoT v3 statistical analysis report

Measured probes: 7350 across 7 conditions (warm-up excluded).

## 1. Summary statistics (recomputed from raw CSVs)

| condition         |    n |   mean |   median |   min |    max |   p95 |    p99 |   jitter_std |
|:------------------|-----:|-------:|---------:|------:|-------:|------:|-------:|-------------:|
| C1_control_only   | 1050 |  22.54 |    16.62 |  3.44 | 303.57 | 58.10 | 117.43 |        23.38 |
| C2_video_normal   | 1050 |  20.20 |    15.87 |  3.63 | 111.47 | 55.26 |  76.84 |        15.24 |
| C3_lidar_detail   | 1050 |  19.63 |    15.65 |  3.62 | 121.90 | 55.45 |  86.74 |        15.91 |
| C4_lidar_medium   | 1050 |  22.68 |    17.30 |  3.31 | 156.37 | 63.60 |  93.49 |        19.00 |
| C5_lidar_panorama | 1050 |  24.51 |    17.86 |  3.89 | 117.50 | 65.53 |  82.84 |        18.98 |
| C6_full_detail    | 1050 |  20.34 |    16.13 |  3.93 | 130.75 | 55.32 |  71.45 |        15.01 |
| C7_full_panorama  | 1050 |  25.08 |    17.60 |  3.56 | 118.67 | 71.87 |  83.86 |        19.79 |

## 2. Kruskal-Wallis omnibus (RTT ~ condition)

H = 70.26, p = <0.001, k = 7, n = 7350

## 3. Pairwise Mann-Whitney U vs C1 baseline (Holm-corrected) + Cliff's delta

| condition         |          U | p_raw   |   cliffs_delta |   p_holm |
|:------------------|-----------:|:--------|---------------:|---------:|
| C2_video_normal   | 520250.000 | 0.026   |         -0.056 |    0.077 |
| C3_lidar_detail   | 503040.500 | <0.001  |         -0.087 |    0.003 |
| C4_lidar_medium   | 558262.000 | 0.614   |          0.013 |    0.614 |
| C5_lidar_panorama | 591958.000 | 0.003   |          0.074 |    0.015 |
| C6_full_detail    | 526556.000 | 0.076   |         -0.045 |    0.151 |
| C7_full_panorama  | 592550.500 | 0.003   |          0.075 |    0.015 |

## 4. Bootstrap 95% CIs (10k resamples)

| condition         |   median |   median_ci_lo |   median_ci_hi |   p95 |   p95_ci_lo |   p95_ci_hi |
|:------------------|---------:|---------------:|---------------:|------:|------------:|------------:|
| C1_control_only   |    16.62 |          16.01 |          17.23 | 58.10 |       53.88 |       63.41 |
| C2_video_normal   |    15.87 |          15.19 |          16.59 | 55.26 |       50.83 |       60.85 |
| C3_lidar_detail   |    15.65 |          14.95 |          16.15 | 55.45 |       48.48 |       60.92 |
| C4_lidar_medium   |    17.30 |          16.68 |          18.03 | 63.60 |       58.36 |       69.91 |
| C5_lidar_panorama |    17.86 |          16.97 |          18.39 | 65.53 |       62.53 |       70.18 |
| C6_full_detail    |    16.13 |          15.32 |          16.70 | 55.32 |       50.49 |       60.88 |
| C7_full_panorama  |    17.60 |          17.02 |          18.74 | 71.87 |       66.70 |       75.15 |

## 5. Tail probability P(RTT > 100 ms)

| condition         |    n |   n_over |   pct_over |
|:------------------|-----:|---------:|-----------:|
| C1_control_only   | 1050 |       14 |      1.333 |
| C2_video_normal   | 1050 |        2 |      0.190 |
| C3_lidar_detail   | 1050 |        4 |      0.381 |
| C4_lidar_medium   | 1050 |        9 |      0.857 |
| C5_lidar_panorama | 1050 |        5 |      0.476 |
| C6_full_detail    | 1050 |        1 |      0.095 |
| C7_full_panorama  | 1050 |        1 |      0.095 |

## 6. Burst clusters (RTT > 100 ms, gap < 5 s)

| condition         |   n_events |   n_clusters |   largest_cluster |   largest_span_s |   max_rtt_ms |
|:------------------|-----------:|-------------:|------------------:|-----------------:|-------------:|
| C1_control_only   |         14 |            2 |                13 |             2.82 |       303.57 |
| C2_video_normal   |          2 |            1 |                 2 |             3.11 |       111.47 |
| C3_lidar_detail   |          4 |            1 |                 4 |             1.01 |       121.90 |
| C4_lidar_medium   |          9 |            2 |                 8 |             2.82 |       156.37 |
| C5_lidar_panorama |          5 |            2 |                 3 |             5.53 |       117.50 |
| C6_full_detail    |          1 |            1 |                 1 |             0.00 |       130.75 |
| C7_full_panorama  |          1 |            1 |                 1 |             0.00 |       118.67 |

## 7. Offered-load model and tail correlation

Synthetic JPEG (640x480, q85, mode=normal): mean 9756 bytes (std 67)

- LiDAR detail grid payload: 120122 bytes (JSON)

- LiDAR medium grid payload: 480122 bytes (JSON)

- LiDAR panorama grid payload: 1080124 bytes (JSON)


| condition         |   video_fps |   jpeg_bytes_mean | lidar_mode   |   lidar_hz |   lidar_payload_bytes |   offered_load_mbps |   median |    p95 |     p99 |
|:------------------|------------:|------------------:|:-------------|-----------:|----------------------:|--------------------:|---------:|-------:|--------:|
| C1_control_only   |           0 |             0.000 | off          |          0 |                     0 |               0.000 |   16.620 | 58.103 | 117.425 |
| C2_video_normal   |          30 |          9756.257 | off          |          0 |                     0 |               2.342 |   15.871 | 55.257 |  76.845 |
| C3_lidar_detail   |           0 |             0.000 | detail       |         12 |                120122 |              11.532 |   15.654 | 55.453 |  86.735 |
| C4_lidar_medium   |           0 |             0.000 | medium       |          8 |                480122 |              30.728 |   17.300 | 63.600 |  93.491 |
| C5_lidar_panorama |           0 |             0.000 | panorama     |          4 |               1080124 |              34.564 |   17.863 | 65.529 |  82.840 |
| C6_full_detail    |          30 |          9756.257 | detail       |         12 |                120122 |              13.873 |   16.129 | 55.319 |  71.453 |
| C7_full_panorama  |          30 |          9756.257 | panorama     |          4 |               1080124 |              36.905 |   17.604 | 71.874 |  83.862 |


Spearman rho(offered load, P95) = 0.750, p = 0.052 (n = 7 conditions)
