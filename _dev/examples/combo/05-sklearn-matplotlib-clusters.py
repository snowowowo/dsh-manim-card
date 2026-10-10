"""综合场景：numpy 造簇 → sklearn KMeans → matplotlib 取色 → Manim 上色

@expect 散点按 KMeans 的簇用 matplotlib 取的色上色：同簇同色、中心可辨。
@note 四个库各司其职：numpy 造点、KMeans 聚类、matplotlib 的 colormap 取色、
      manim 上色画散点。簇标签是 numpy 数组，索引与逐点取色都用上——
      颜色从「库算出来的 hex 串」一路交给 manim，这条转换最容易踩坑。
"""

from manim import *
import numpy as np
import matplotlib
import matplotlib.pyplot as plt
from sklearn.cluster import KMeans

rng = np.random.default_rng(1)
centers = np.array([[0.0, 0.0], [3.0, 3.5], [0.5, 4.0]])
pts = np.vstack([c + rng.normal(0, 0.45, (25, 2)) for c in centers])

km = KMeans(n_clusters=3, n_init=10, random_state=0).fit(pts)
labels = km.labels_

cmap = plt.get_cmap("viridis")
hexes = [matplotlib.colors.to_hex(cmap(i / 2.0)) for i in range(3)]
cols = [hexes[int(label)] for label in labels]
print("combo-kmeans", int(km.n_clusters), round(float(km.inertia_), 2), hexes[0])

px = pts[:, 0].astype(float)
py = pts[:, 1].astype(float)


class ComboKMeansScene(Scene):
    def construct(self):
        ax = Axes(x_range=[-2, 5, 1], y_range=[-2, 6, 2])
        dots = VGroup(*[
            Dot(point=ax.c2p(float(a), float(b)), color=cols[i])
            for i, (a, b) in enumerate(zip(px, py))
        ])
        self.play(Create(ax), FadeIn(dots))
        self.wait(0.3)
