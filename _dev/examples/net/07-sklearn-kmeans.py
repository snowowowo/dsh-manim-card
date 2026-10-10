"""scikit-learn：KMeans 聚类

@expect 散点按簇着色、簇中心被标出，分簇与数据分布相符。
@note 簇号决定点色，直接喂给 Dot——把「算出来的分类」画出来是 AI 常写的用法
"""

from manim import *
import numpy as np
from sklearn.cluster import KMeans

rng = np.random.default_rng(11)
centers = np.array([[0.0, 0.0], [5.0, 5.0], [0.0, 5.0]])
pts = np.vstack([center + rng.normal(0, 0.6, (25, 2)) for center in centers])
labels = KMeans(n_clusters=3, n_init=10, random_state=0).fit_predict(pts)
palette = [RED, BLUE, GREEN]
print("kmeans", sorted(set(labels.tolist())))


class KMeansScene(Scene):
    def construct(self):
        ax = Axes(x_range=[-2, 7, 2], y_range=[-2, 7, 2])
        dots = VGroup(
            *[
                Dot(point=ax.c2p(float(px), float(py)), color=palette[int(label) % len(palette)])
                for (px, py), label in zip(pts, labels)
            ]
        )
        self.play(Create(ax), FadeIn(dots))
        self.wait(0.3)
