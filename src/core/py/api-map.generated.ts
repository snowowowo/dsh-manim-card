// 由 scripts/probe-api.mjs 生成（勿手改；升级 manim-web 或 CE 后重跑）。
// 事实来源：Manim CE 0.22.0（域清单 scripts/ce-public-api.json）× manim-web 0.3.24
//            —— 无头浏览器内逐项实测：ok=直用；alias=改名/改写映射（判定层翻得出可执行调用）；
//               missing=缺失（alt 为报错替代文案）。
// 注意：域清单只定「测哪些名字」，不定「它是什么」——kind（物体/动画）按 manim-web 的运行时原型链实测。
//        CE 把 TracedPath / AnimatedBoundary 放在 animation/ 模块里，两者其实 extends VMobject。

export type PyApiState = 'ok' | 'alias' | 'missing'

export interface PyApiEntry {
  kind: 'class' | 'anim' | 'function' | 'const' | 'color' | 'rate' | 'method' | 'scene-method'
  state: PyApiState
  /** ok/alias 的目标写法（js 真名或映射说明） */
  js?: string
  /** alias/missing 的替代方案（进报错文案） */
  alt?: string
  /** anim：调工厂函数（CE 形状）还是类构造——manim-web 两者的参数形状不一样 */
  call?: 'factory' | 'new'
  /** rate：manim-web 里是柯里化工厂，要先无参调一次才拿到速率函数 */
  curried?: boolean
  /** method 实测命中的探测实例（只留前几个；总数见 hits） */
  targets?: string[]
  /** method 实测命中的实例总数 */
  hits?: number
}

export const PY_API_MAP: Record<string, PyApiEntry> = {
  "Angle": {
    "kind": "class",
    "state": "ok",
    "js": "manim.Angle"
  },
  "AnnotationDot": {
    "kind": "class",
    "state": "ok",
    "js": "manim.AnnotationDot"
  },
  "AnnularSector": {
    "kind": "class",
    "state": "ok",
    "js": "manim.AnnularSector"
  },
  "Annulus": {
    "kind": "class",
    "state": "ok",
    "js": "manim.Annulus"
  },
  "Arc": {
    "kind": "class",
    "state": "ok",
    "js": "manim.Arc"
  },
  "ArcBetweenPoints": {
    "kind": "class",
    "state": "ok",
    "js": "manim.ArcBetweenPoints"
  },
  "ArcBrace": {
    "kind": "class",
    "state": "ok",
    "js": "manim.ArcBrace"
  },
  "ArcPolygon": {
    "kind": "class",
    "state": "ok",
    "js": "manim.ArcPolygon"
  },
  "ArcPolygonFromArcs": {
    "kind": "class",
    "state": "missing",
    "alt": "manim-web 没有这个形状（ArcPolygonFromArcs）——查支持速查表选等价写法"
  },
  "Arrow": {
    "kind": "class",
    "state": "ok",
    "js": "manim.Arrow"
  },
  "Arrow3D": {
    "kind": "class",
    "state": "ok",
    "js": "manim.Arrow3D"
  },
  "ArrowCircleFilledTip": {
    "kind": "class",
    "state": "ok",
    "js": "manim.ArrowCircleFilledTip"
  },
  "ArrowCircleTip": {
    "kind": "class",
    "state": "ok",
    "js": "manim.ArrowCircleTip"
  },
  "ArrowSquareFilledTip": {
    "kind": "class",
    "state": "ok",
    "js": "manim.ArrowSquareFilledTip"
  },
  "ArrowSquareTip": {
    "kind": "class",
    "state": "ok",
    "js": "manim.ArrowSquareTip"
  },
  "ArrowTip": {
    "kind": "class",
    "state": "ok",
    "js": "manim.ArrowTip"
  },
  "ArrowTriangleFilledTip": {
    "kind": "class",
    "state": "ok",
    "js": "manim.ArrowTriangleFilledTip"
  },
  "ArrowTriangleTip": {
    "kind": "class",
    "state": "ok",
    "js": "manim.ArrowTriangleTip"
  },
  "ArrowVectorField": {
    "kind": "class",
    "state": "ok",
    "js": "manim.ArrowVectorField"
  },
  "Axes": {
    "kind": "class",
    "state": "ok",
    "js": "manim.Axes"
  },
  "BackgroundRectangle": {
    "kind": "class",
    "state": "ok",
    "js": "manim.BackgroundRectangle"
  },
  "BarChart": {
    "kind": "class",
    "state": "ok",
    "js": "manim.BarChart"
  },
  "Brace": {
    "kind": "class",
    "state": "ok",
    "js": "manim.Brace"
  },
  "BraceBetweenPoints": {
    "kind": "class",
    "state": "ok",
    "js": "manim.BraceBetweenPoints"
  },
  "BraceLabel": {
    "kind": "class",
    "state": "ok",
    "js": "manim.BraceLabel"
  },
  "BraceText": {
    "kind": "class",
    "state": "ok",
    "js": "manim.BraceText"
  },
  "BulletedList": {
    "kind": "class",
    "state": "ok",
    "js": "manim.BulletedList"
  },
  "Circle": {
    "kind": "class",
    "state": "ok",
    "js": "manim.Circle"
  },
  "Code": {
    "kind": "class",
    "state": "ok",
    "js": "manim.Code"
  },
  "ComplexPlane": {
    "kind": "class",
    "state": "ok",
    "js": "manim.ComplexPlane"
  },
  "ComplexValueTracker": {
    "kind": "class",
    "state": "ok",
    "js": "manim.ComplexValueTracker"
  },
  "Cone": {
    "kind": "class",
    "state": "ok",
    "js": "manim.Cone"
  },
  "ConvexHull": {
    "kind": "class",
    "state": "ok",
    "js": "manim.ConvexHull"
  },
  "ConvexHull3D": {
    "kind": "class",
    "state": "ok",
    "js": "manim.ConvexHull3D"
  },
  "CoordinateSystem": {
    "kind": "class",
    "state": "missing",
    "alt": "manim-web 没有这个形状（CoordinateSystem）——查支持速查表选等价写法"
  },
  "Cross": {
    "kind": "class",
    "state": "ok",
    "js": "manim.Cross"
  },
  "Cube": {
    "kind": "class",
    "state": "ok",
    "js": "manim.Cube"
  },
  "CubicBezier": {
    "kind": "class",
    "state": "ok",
    "js": "manim.CubicBezier"
  },
  "CurvedArrow": {
    "kind": "class",
    "state": "ok",
    "js": "manim.CurvedArrow"
  },
  "CurvedDoubleArrow": {
    "kind": "class",
    "state": "ok",
    "js": "manim.CurvedDoubleArrow"
  },
  "CurvesAsSubmobjects": {
    "kind": "class",
    "state": "missing",
    "alt": "manim-web 没有这个形状（CurvesAsSubmobjects）——查支持速查表选等价写法"
  },
  "Cutout": {
    "kind": "class",
    "state": "ok",
    "js": "manim.Cutout"
  },
  "Cylinder": {
    "kind": "class",
    "state": "ok",
    "js": "manim.Cylinder"
  },
  "DashedLine": {
    "kind": "class",
    "state": "ok",
    "js": "manim.DashedLine"
  },
  "DashedVMobject": {
    "kind": "class",
    "state": "ok",
    "js": "manim.DashedVMobject"
  },
  "DecimalMatrix": {
    "kind": "class",
    "state": "ok",
    "js": "manim.DecimalMatrix"
  },
  "DecimalNumber": {
    "kind": "class",
    "state": "ok",
    "js": "manim.DecimalNumber"
  },
  "DecimalTable": {
    "kind": "class",
    "state": "ok",
    "js": "manim.DecimalTable"
  },
  "DefaultSectionType": {
    "kind": "class",
    "state": "missing",
    "alt": "manim-web 没有这个形状（DefaultSectionType）——查支持速查表选等价写法"
  },
  "DiGraph": {
    "kind": "class",
    "state": "ok",
    "js": "manim.DiGraph"
  },
  "Difference": {
    "kind": "class",
    "state": "ok",
    "js": "manim.Difference"
  },
  "Dodecahedron": {
    "kind": "class",
    "state": "ok",
    "js": "manim.Dodecahedron"
  },
  "Dot": {
    "kind": "class",
    "state": "ok",
    "js": "manim.Dot"
  },
  "Dot3D": {
    "kind": "class",
    "state": "ok",
    "js": "manim.Dot3D"
  },
  "DotCloud": {
    "kind": "class",
    "state": "missing",
    "alt": "manim-web 没有这个形状（DotCloud）——查支持速查表选等价写法"
  },
  "DoubleArrow": {
    "kind": "class",
    "state": "ok",
    "js": "manim.DoubleArrow"
  },
  "Elbow": {
    "kind": "class",
    "state": "ok",
    "js": "manim.Elbow"
  },
  "Ellipse": {
    "kind": "class",
    "state": "ok",
    "js": "manim.Ellipse"
  },
  "Exclusion": {
    "kind": "class",
    "state": "ok",
    "js": "manim.Exclusion"
  },
  "FullScreenRectangle": {
    "kind": "class",
    "state": "ok",
    "js": "manim.FullScreenRectangle"
  },
  "FunctionGraph": {
    "kind": "class",
    "state": "ok",
    "js": "manim.FunctionGraph"
  },
  "Graph": {
    "kind": "class",
    "state": "ok",
    "js": "manim.Graph"
  },
  "Group": {
    "kind": "class",
    "state": "ok",
    "js": "manim.Group"
  },
  "Icosahedron": {
    "kind": "class",
    "state": "ok",
    "js": "manim.Icosahedron"
  },
  "ImageMobject": {
    "kind": "class",
    "state": "ok",
    "js": "manim.ImageMobject"
  },
  "ImageMobjectFromCamera": {
    "kind": "class",
    "state": "missing",
    "alt": "manim-web 没有这个形状（ImageMobjectFromCamera）——查支持速查表选等价写法"
  },
  "ImplicitFunction": {
    "kind": "class",
    "state": "ok",
    "js": "manim.ImplicitFunction"
  },
  "Integer": {
    "kind": "class",
    "state": "ok",
    "js": "manim.Integer"
  },
  "IntegerMatrix": {
    "kind": "class",
    "state": "ok",
    "js": "manim.IntegerMatrix"
  },
  "IntegerTable": {
    "kind": "class",
    "state": "ok",
    "js": "manim.IntegerTable"
  },
  "Intersection": {
    "kind": "class",
    "state": "ok",
    "js": "manim.Intersection"
  },
  "Label": {
    "kind": "class",
    "state": "missing",
    "alt": "manim-web 没有这个形状（Label）——查支持速查表选等价写法"
  },
  "LabeledArrow": {
    "kind": "class",
    "state": "ok",
    "js": "manim.LabeledArrow"
  },
  "LabeledDot": {
    "kind": "class",
    "state": "ok",
    "js": "manim.LabeledDot"
  },
  "LabeledLine": {
    "kind": "class",
    "state": "ok",
    "js": "manim.LabeledLine"
  },
  "LabeledPolygram": {
    "kind": "class",
    "state": "ok",
    "js": "manim.LabeledPolygram"
  },
  "Line": {
    "kind": "class",
    "state": "ok",
    "js": "manim.Line"
  },
  "Line3D": {
    "kind": "class",
    "state": "ok",
    "js": "manim.Line3D"
  },
  "LinearBase": {
    "kind": "class",
    "state": "missing",
    "alt": "manim-web 没有这个形状（LinearBase）——查支持速查表选等价写法"
  },
  "LinearTransformationScene": {
    "kind": "class",
    "state": "ok",
    "js": "manim.LinearTransformationScene"
  },
  "LogBase": {
    "kind": "class",
    "state": "missing",
    "alt": "manim-web 没有这个形状（LogBase）——查支持速查表选等价写法"
  },
  "ManimBanner": {
    "kind": "class",
    "state": "ok",
    "js": "manim.ManimBanner"
  },
  "MarkupText": {
    "kind": "class",
    "state": "ok",
    "js": "manim.MarkupText"
  },
  "MathTable": {
    "kind": "class",
    "state": "ok",
    "js": "manim.MathTable"
  },
  "MathTex": {
    "kind": "class",
    "state": "ok",
    "js": "manim.MathTex"
  },
  "MathTypst": {
    "kind": "class",
    "state": "missing",
    "alt": "manim-web 没有这个形状（MathTypst）——查支持速查表选等价写法"
  },
  "Matrix": {
    "kind": "class",
    "state": "ok",
    "js": "manim.Matrix"
  },
  "Mobject": {
    "kind": "class",
    "state": "ok",
    "js": "manim.Mobject"
  },
  "Mobject1D": {
    "kind": "class",
    "state": "ok",
    "js": "manim.Mobject1D"
  },
  "Mobject2D": {
    "kind": "class",
    "state": "ok",
    "js": "manim.Mobject2D"
  },
  "MobjectMatrix": {
    "kind": "class",
    "state": "ok",
    "js": "manim.MobjectMatrix"
  },
  "MobjectTable": {
    "kind": "class",
    "state": "ok",
    "js": "manim.MobjectTable"
  },
  "MovingCameraScene": {
    "kind": "class",
    "state": "ok",
    "js": "manim.MovingCameraScene"
  },
  "NumberLine": {
    "kind": "class",
    "state": "ok",
    "js": "manim.NumberLine"
  },
  "NumberPlane": {
    "kind": "class",
    "state": "ok",
    "js": "manim.NumberPlane"
  },
  "Octahedron": {
    "kind": "class",
    "state": "ok",
    "js": "manim.Octahedron"
  },
  "OpenGLPGroup": {
    "kind": "class",
    "state": "missing",
    "alt": "manim-web 没有这个形状（OpenGLPGroup）——查支持速查表选等价写法"
  },
  "OpenGLPMPoint": {
    "kind": "class",
    "state": "missing",
    "alt": "manim-web 没有这个形状（OpenGLPMPoint）——查支持速查表选等价写法"
  },
  "OpenGLPMobject": {
    "kind": "class",
    "state": "missing",
    "alt": "manim-web 没有这个形状（OpenGLPMobject）——查支持速查表选等价写法"
  },
  "PGroup": {
    "kind": "class",
    "state": "ok",
    "js": "manim.PGroup"
  },
  "PMobject": {
    "kind": "class",
    "state": "ok",
    "js": "manim.PMobject"
  },
  "Paragraph": {
    "kind": "class",
    "state": "ok",
    "js": "manim.Paragraph"
  },
  "ParametricFunction": {
    "kind": "class",
    "state": "ok",
    "js": "manim.ParametricFunction"
  },
  "Point": {
    "kind": "class",
    "state": "missing",
    "alt": "manim-web 没有这个形状（Point）——查支持速查表选等价写法"
  },
  "PointCloudDot": {
    "kind": "class",
    "state": "ok",
    "js": "manim.PointCloudDot"
  },
  "PolarPlane": {
    "kind": "class",
    "state": "ok",
    "js": "manim.PolarPlane"
  },
  "Polygon": {
    "kind": "class",
    "state": "ok",
    "js": "manim.Polygon"
  },
  "Polygram": {
    "kind": "class",
    "state": "ok",
    "js": "manim.Polygram"
  },
  "Polyhedron": {
    "kind": "class",
    "state": "ok",
    "js": "manim.Polyhedron"
  },
  "Prism": {
    "kind": "class",
    "state": "ok",
    "js": "manim.Prism"
  },
  "Rectangle": {
    "kind": "class",
    "state": "ok",
    "js": "manim.Rectangle"
  },
  "RegularPolygon": {
    "kind": "class",
    "state": "ok",
    "js": "manim.RegularPolygon"
  },
  "RegularPolygram": {
    "kind": "class",
    "state": "ok",
    "js": "manim.RegularPolygram"
  },
  "RightAngle": {
    "kind": "class",
    "state": "ok",
    "js": "manim.RightAngle"
  },
  "RoundedRectangle": {
    "kind": "class",
    "state": "ok",
    "js": "manim.RoundedRectangle"
  },
  "SVGMobject": {
    "kind": "class",
    "state": "ok",
    "js": "manim.SVGMobject"
  },
  "SampleSpace": {
    "kind": "class",
    "state": "ok",
    "js": "manim.SampleSpace"
  },
  "Scene": {
    "kind": "class",
    "state": "ok",
    "js": "manim.Scene"
  },
  "SceneFileWriter": {
    "kind": "class",
    "state": "missing",
    "alt": "manim-web 没有这个形状（SceneFileWriter）——查支持速查表选等价写法"
  },
  "ScreenRectangle": {
    "kind": "class",
    "state": "ok",
    "js": "manim.ScreenRectangle"
  },
  "Section": {
    "kind": "class",
    "state": "missing",
    "alt": "manim-web 没有这个形状（Section）——查支持速查表选等价写法"
  },
  "Sector": {
    "kind": "class",
    "state": "ok",
    "js": "manim.Sector"
  },
  "SingleStringMathTex": {
    "kind": "class",
    "state": "ok",
    "js": "manim.SingleStringMathTex"
  },
  "SpecialThreeDScene": {
    "kind": "class",
    "state": "missing",
    "alt": "manim-web 没有这个形状（SpecialThreeDScene）——查支持速查表选等价写法"
  },
  "Sphere": {
    "kind": "class",
    "state": "ok",
    "js": "manim.Sphere"
  },
  "Square": {
    "kind": "class",
    "state": "ok",
    "js": "manim.Square"
  },
  "Star": {
    "kind": "class",
    "state": "ok",
    "js": "manim.Star"
  },
  "StealthTip": {
    "kind": "class",
    "state": "ok",
    "js": "manim.StealthTip"
  },
  "StreamLines": {
    "kind": "class",
    "state": "ok",
    "js": "manim.StreamLines"
  },
  "Surface": {
    "kind": "class",
    "state": "missing",
    "alt": "manim-web 没有这个形状（Surface）——查支持速查表选等价写法"
  },
  "SurroundingRectangle": {
    "kind": "class",
    "state": "ok",
    "js": "manim.SurroundingRectangle"
  },
  "Table": {
    "kind": "class",
    "state": "ok",
    "js": "manim.Table"
  },
  "TangentLine": {
    "kind": "class",
    "state": "ok",
    "js": "manim.TangentLine"
  },
  "TangentialArc": {
    "kind": "class",
    "state": "ok",
    "js": "manim.TangentialArc"
  },
  "Tetrahedron": {
    "kind": "class",
    "state": "ok",
    "js": "manim.Tetrahedron"
  },
  "Tex": {
    "kind": "class",
    "state": "ok",
    "js": "manim.Tex"
  },
  "Text": {
    "kind": "class",
    "state": "ok",
    "js": "manim.Text"
  },
  "ThreeDAxes": {
    "kind": "class",
    "state": "ok",
    "js": "manim.ThreeDAxes"
  },
  "ThreeDScene": {
    "kind": "class",
    "state": "ok",
    "js": "manim.ThreeDScene"
  },
  "ThreeDVMobject": {
    "kind": "class",
    "state": "ok",
    "js": "manim.ThreeDVMobject"
  },
  "TipableVMobject": {
    "kind": "class",
    "state": "ok",
    "js": "manim.TipableVMobject"
  },
  "Title": {
    "kind": "class",
    "state": "ok",
    "js": "manim.Title"
  },
  "Torus": {
    "kind": "class",
    "state": "ok",
    "js": "manim.Torus"
  },
  "Triangle": {
    "kind": "class",
    "state": "ok",
    "js": "manim.Triangle"
  },
  "TrueDot": {
    "kind": "class",
    "state": "missing",
    "alt": "manim-web 没有这个形状（TrueDot）——查支持速查表选等价写法"
  },
  "Typst": {
    "kind": "class",
    "state": "missing",
    "alt": "manim-web 没有这个形状（Typst）——查支持速查表选等价写法"
  },
  "Underline": {
    "kind": "class",
    "state": "ok",
    "js": "manim.Underline"
  },
  "Union": {
    "kind": "class",
    "state": "ok",
    "js": "manim.Union"
  },
  "UnitInterval": {
    "kind": "class",
    "state": "ok",
    "js": "manim.UnitInterval"
  },
  "VDict": {
    "kind": "class",
    "state": "ok",
    "js": "manim.VDict"
  },
  "VGroup": {
    "kind": "class",
    "state": "ok",
    "js": "manim.VGroup"
  },
  "VMobject": {
    "kind": "class",
    "state": "ok",
    "js": "manim.VMobject"
  },
  "VMobjectFromSVGPath": {
    "kind": "class",
    "state": "ok",
    "js": "manim.VMobjectFromSVGPath"
  },
  "ValueTracker": {
    "kind": "class",
    "state": "ok",
    "js": "manim.ValueTracker"
  },
  "Variable": {
    "kind": "class",
    "state": "ok",
    "js": "manim.Variable"
  },
  "Vector": {
    "kind": "class",
    "state": "ok",
    "js": "manim.Vector"
  },
  "VectorField": {
    "kind": "class",
    "state": "ok",
    "js": "manim.VectorField"
  },
  "VectorScene": {
    "kind": "class",
    "state": "ok",
    "js": "manim.VectorScene"
  },
  "VectorizedPoint": {
    "kind": "class",
    "state": "ok",
    "js": "manim.VectorizedPoint"
  },
  "ZoomedScene": {
    "kind": "class",
    "state": "ok",
    "js": "manim.ZoomedScene"
  },
  "Add": {
    "kind": "anim",
    "state": "ok",
    "js": "add",
    "call": "factory"
  },
  "AddTextLetterByLetter": {
    "kind": "anim",
    "state": "ok",
    "js": "addTextLetterByLetter",
    "call": "factory"
  },
  "AddTextWordByWord": {
    "kind": "anim",
    "state": "ok",
    "js": "addTextWordByWord",
    "call": "factory"
  },
  "AnimatedBoundary": {
    "kind": "class",
    "state": "ok",
    "js": "manim.AnimatedBoundary"
  },
  "Animation": {
    "kind": "anim",
    "state": "ok",
    "js": "Animation",
    "call": "new"
  },
  "AnimationGroup": {
    "kind": "anim",
    "state": "ok",
    "js": "animationGroup",
    "call": "factory"
  },
  "ApplyComplexFunction": {
    "kind": "anim",
    "state": "ok",
    "js": "applyComplexFunction",
    "call": "factory"
  },
  "ApplyFunction": {
    "kind": "anim",
    "state": "ok",
    "js": "applyFunction",
    "call": "factory"
  },
  "ApplyMatrix": {
    "kind": "anim",
    "state": "ok",
    "js": "applyMatrix",
    "call": "factory"
  },
  "ApplyMethod": {
    "kind": "anim",
    "state": "ok",
    "js": "applyMethod",
    "call": "factory"
  },
  "ApplyPointwiseFunction": {
    "kind": "anim",
    "state": "ok",
    "js": "applyPointwiseFunction",
    "call": "factory"
  },
  "ApplyPointwiseFunctionToCenter": {
    "kind": "anim",
    "state": "ok",
    "js": "applyPointwiseFunctionToCenter",
    "call": "factory"
  },
  "ApplyWave": {
    "kind": "anim",
    "state": "ok",
    "js": "applyWave",
    "call": "factory"
  },
  "Blink": {
    "kind": "anim",
    "state": "ok",
    "js": "blink",
    "call": "factory"
  },
  "Broadcast": {
    "kind": "anim",
    "state": "ok",
    "js": "broadcast",
    "call": "factory"
  },
  "ChangeDecimalToValue": {
    "kind": "anim",
    "state": "ok",
    "js": "changeDecimalToValue",
    "call": "factory"
  },
  "ChangeSpeed": {
    "kind": "anim",
    "state": "ok",
    "js": "changeSpeed",
    "call": "factory"
  },
  "ChangingDecimal": {
    "kind": "anim",
    "state": "ok",
    "js": "changingDecimal",
    "call": "factory"
  },
  "Circumscribe": {
    "kind": "anim",
    "state": "ok",
    "js": "circumscribe",
    "call": "factory"
  },
  "ClockwiseTransform": {
    "kind": "anim",
    "state": "ok",
    "js": "clockwiseTransform",
    "call": "factory"
  },
  "ComplexHomotopy": {
    "kind": "anim",
    "state": "ok",
    "js": "complexHomotopy",
    "call": "factory"
  },
  "CounterclockwiseTransform": {
    "kind": "anim",
    "state": "ok",
    "js": "counterclockwiseTransform",
    "call": "factory"
  },
  "Create": {
    "kind": "anim",
    "state": "ok",
    "js": "create",
    "call": "factory"
  },
  "CyclicReplace": {
    "kind": "anim",
    "state": "ok",
    "js": "cyclicReplace",
    "call": "factory"
  },
  "DrawBorderThenFill": {
    "kind": "anim",
    "state": "ok",
    "js": "drawBorderThenFill",
    "call": "factory"
  },
  "FadeIn": {
    "kind": "anim",
    "state": "ok",
    "js": "fadeIn",
    "call": "factory"
  },
  "FadeOut": {
    "kind": "anim",
    "state": "ok",
    "js": "fadeOut",
    "call": "factory"
  },
  "FadeToColor": {
    "kind": "anim",
    "state": "ok",
    "js": "fadeToColor",
    "call": "factory"
  },
  "FadeTransform": {
    "kind": "anim",
    "state": "ok",
    "js": "fadeTransform",
    "call": "factory"
  },
  "FadeTransformPieces": {
    "kind": "anim",
    "state": "ok",
    "js": "fadeTransformPieces",
    "call": "factory"
  },
  "Flash": {
    "kind": "anim",
    "state": "ok",
    "js": "flash",
    "call": "factory"
  },
  "FocusOn": {
    "kind": "anim",
    "state": "ok",
    "js": "focusOn",
    "call": "factory"
  },
  "GrowArrow": {
    "kind": "anim",
    "state": "ok",
    "js": "growArrow",
    "call": "factory"
  },
  "GrowFromCenter": {
    "kind": "anim",
    "state": "ok",
    "js": "growFromCenter",
    "call": "factory"
  },
  "GrowFromEdge": {
    "kind": "anim",
    "state": "ok",
    "js": "growFromEdge",
    "call": "factory"
  },
  "GrowFromPoint": {
    "kind": "anim",
    "state": "ok",
    "js": "growFromPoint",
    "call": "factory"
  },
  "Homotopy": {
    "kind": "anim",
    "state": "ok",
    "js": "homotopy",
    "call": "factory"
  },
  "Indicate": {
    "kind": "anim",
    "state": "ok",
    "js": "indicate",
    "call": "factory"
  },
  "LaggedStart": {
    "kind": "anim",
    "state": "ok",
    "js": "laggedStart",
    "call": "factory"
  },
  "LaggedStartMap": {
    "kind": "anim",
    "state": "ok",
    "js": "laggedStartMap",
    "call": "factory"
  },
  "MaintainPositionRelativeTo": {
    "kind": "anim",
    "state": "missing",
    "alt": "manim-web 没有这个形状（MaintainPositionRelativeTo）——查支持速查表选等价写法"
  },
  "MoveAlongPath": {
    "kind": "anim",
    "state": "ok",
    "js": "moveAlongPath",
    "call": "factory"
  },
  "MoveToTarget": {
    "kind": "anim",
    "state": "ok",
    "js": "moveToTarget",
    "call": "factory"
  },
  "PhaseFlow": {
    "kind": "anim",
    "state": "ok",
    "js": "phaseFlow",
    "call": "factory"
  },
  "RemoveTextLetterByLetter": {
    "kind": "anim",
    "state": "ok",
    "js": "removeTextLetterByLetter",
    "call": "factory"
  },
  "ReplacementTransform": {
    "kind": "anim",
    "state": "ok",
    "js": "replacementTransform",
    "call": "factory"
  },
  "Restore": {
    "kind": "anim",
    "state": "ok",
    "js": "restore",
    "call": "factory"
  },
  "Rotate": {
    "kind": "anim",
    "state": "ok",
    "js": "rotate",
    "call": "factory"
  },
  "Rotating": {
    "kind": "anim",
    "state": "ok",
    "js": "rotating",
    "call": "factory"
  },
  "ScaleInPlace": {
    "kind": "anim",
    "state": "ok",
    "js": "scaleInPlace",
    "call": "factory"
  },
  "ShowIncreasingSubsets": {
    "kind": "anim",
    "state": "ok",
    "js": "showIncreasingSubsets",
    "call": "factory"
  },
  "ShowPartial": {
    "kind": "anim",
    "state": "ok",
    "js": "showPartial",
    "call": "factory"
  },
  "ShowPassingFlash": {
    "kind": "anim",
    "state": "ok",
    "js": "showPassingFlash",
    "call": "factory"
  },
  "ShowPassingFlashWithThinningStrokeWidth": {
    "kind": "anim",
    "state": "ok",
    "js": "showPassingFlashWithThinningStrokeWidth",
    "call": "factory"
  },
  "ShowSubmobjectsOneByOne": {
    "kind": "anim",
    "state": "ok",
    "js": "showSubmobjectsOneByOne",
    "call": "factory"
  },
  "ShrinkToCenter": {
    "kind": "anim",
    "state": "ok",
    "js": "shrinkToCenter",
    "call": "factory"
  },
  "SmoothedVectorizedHomotopy": {
    "kind": "anim",
    "state": "ok",
    "js": "smoothedVectorizedHomotopy",
    "call": "factory"
  },
  "SpinInFromNothing": {
    "kind": "anim",
    "state": "ok",
    "js": "spinInFromNothing",
    "call": "factory"
  },
  "SpiralIn": {
    "kind": "anim",
    "state": "ok",
    "js": "spiralIn",
    "call": "factory"
  },
  "Succession": {
    "kind": "anim",
    "state": "ok",
    "js": "succession",
    "call": "factory"
  },
  "Swap": {
    "kind": "anim",
    "state": "ok",
    "js": "swap",
    "call": "factory"
  },
  "TracedPath": {
    "kind": "class",
    "state": "ok",
    "js": "manim.TracedPath"
  },
  "Transform": {
    "kind": "anim",
    "state": "ok",
    "js": "transform",
    "call": "factory"
  },
  "TransformAnimations": {
    "kind": "anim",
    "state": "ok",
    "js": "transformAnimations",
    "call": "factory"
  },
  "TransformFromCopy": {
    "kind": "anim",
    "state": "ok",
    "js": "transformFromCopy",
    "call": "factory"
  },
  "TransformMatchingShapes": {
    "kind": "anim",
    "state": "ok",
    "js": "transformMatchingShapes",
    "call": "factory"
  },
  "TransformMatchingTex": {
    "kind": "anim",
    "state": "ok",
    "js": "transformMatchingTex",
    "call": "factory"
  },
  "TypeWithCursor": {
    "kind": "anim",
    "state": "ok",
    "js": "typeWithCursor",
    "call": "factory"
  },
  "Uncreate": {
    "kind": "anim",
    "state": "ok",
    "js": "uncreate",
    "call": "factory"
  },
  "UntypeWithCursor": {
    "kind": "anim",
    "state": "ok",
    "js": "untypeWithCursor",
    "call": "factory"
  },
  "Unwrite": {
    "kind": "anim",
    "state": "ok",
    "js": "unwrite",
    "call": "factory"
  },
  "UpdateFromAlphaFunc": {
    "kind": "anim",
    "state": "ok",
    "js": "updateFromAlphaFunc",
    "call": "factory"
  },
  "UpdateFromFunc": {
    "kind": "anim",
    "state": "ok",
    "js": "updateFromFunc",
    "call": "factory"
  },
  "Wait": {
    "kind": "anim",
    "state": "ok",
    "js": "wait",
    "call": "factory"
  },
  "Wiggle": {
    "kind": "anim",
    "state": "ok",
    "js": "wiggle",
    "call": "factory"
  },
  "Write": {
    "kind": "anim",
    "state": "ok",
    "js": "write",
    "call": "factory"
  },
  "always": {
    "kind": "function",
    "state": "missing",
    "alt": "用 add_updater() 组合重画"
  },
  "always_redraw": {
    "kind": "function",
    "state": "missing",
    "alt": "用 add_updater() 组合重画"
  },
  "always_rotate": {
    "kind": "function",
    "state": "missing",
    "alt": "用 add_updater() 挂 rotate"
  },
  "always_shift": {
    "kind": "function",
    "state": "missing",
    "alt": "用 add_updater() 挂 shift"
  },
  "assert_is_mobject_method": {
    "kind": "function",
    "state": "missing",
    "alt": "manim-web 没有这个函数——用 add_updater() 自己写"
  },
  "cycle_animation": {
    "kind": "function",
    "state": "missing",
    "alt": "manim-web 没有这个函数——用 add_updater() 自己写"
  },
  "f_always": {
    "kind": "function",
    "state": "missing",
    "alt": "manim-web 没有这个函数——用 add_updater() 自己写"
  },
  "override_animation": {
    "kind": "function",
    "state": "missing",
    "alt": "manim-web 没有这个函数——用 add_updater() 自己写"
  },
  "turn_animation_into_updater": {
    "kind": "function",
    "state": "missing",
    "alt": "manim-web 没有这个函数——用 add_updater() 自己写"
  },
  "DL": {
    "kind": "const",
    "state": "ok",
    "js": "manim.DL"
  },
  "DOWN": {
    "kind": "const",
    "state": "ok",
    "js": "manim.DOWN"
  },
  "DR": {
    "kind": "const",
    "state": "ok",
    "js": "manim.DR"
  },
  "IN": {
    "kind": "const",
    "state": "ok",
    "js": "manim.IN"
  },
  "LEFT": {
    "kind": "const",
    "state": "ok",
    "js": "manim.LEFT"
  },
  "ORIGIN": {
    "kind": "const",
    "state": "ok",
    "js": "manim.ORIGIN"
  },
  "OUT": {
    "kind": "const",
    "state": "ok",
    "js": "manim.OUT"
  },
  "RIGHT": {
    "kind": "const",
    "state": "ok",
    "js": "manim.RIGHT"
  },
  "UL": {
    "kind": "const",
    "state": "ok",
    "js": "manim.UL"
  },
  "UP": {
    "kind": "const",
    "state": "ok",
    "js": "manim.UP"
  },
  "UR": {
    "kind": "const",
    "state": "ok",
    "js": "manim.UR"
  },
  "X_AXIS": {
    "kind": "const",
    "state": "ok",
    "js": "X_AXIS"
  },
  "Y_AXIS": {
    "kind": "const",
    "state": "ok",
    "js": "Y_AXIS"
  },
  "Z_AXIS": {
    "kind": "const",
    "state": "ok",
    "js": "Z_AXIS"
  },
  "DEGREES": {
    "kind": "const",
    "state": "ok",
    "js": "DEGREES"
  },
  "PI": {
    "kind": "const",
    "state": "ok",
    "js": "PI"
  },
  "TAU": {
    "kind": "const",
    "state": "ok",
    "js": "TAU"
  },
  "BLACK": {
    "kind": "color",
    "state": "ok",
    "js": "#000000"
  },
  "BLUE": {
    "kind": "color",
    "state": "ok",
    "js": "#58C4DD"
  },
  "BLUE_A": {
    "kind": "color",
    "state": "ok",
    "js": "#C7E9F1"
  },
  "BLUE_B": {
    "kind": "color",
    "state": "ok",
    "js": "#9CDCEB"
  },
  "BLUE_C": {
    "kind": "color",
    "state": "ok",
    "js": "#58C4DD"
  },
  "BLUE_D": {
    "kind": "color",
    "state": "ok",
    "js": "#29ABCA"
  },
  "BLUE_E": {
    "kind": "color",
    "state": "ok",
    "js": "#236B8E"
  },
  "DARKER_GRAY": {
    "kind": "color",
    "state": "ok",
    "js": "#222222"
  },
  "DARKER_GREY": {
    "kind": "color",
    "state": "missing",
    "alt": "画布不支持——用 hex 字符串"
  },
  "DARK_BLUE": {
    "kind": "color",
    "state": "ok",
    "js": "#236B8E"
  },
  "DARK_BROWN": {
    "kind": "color",
    "state": "ok",
    "js": "#8B4513"
  },
  "DARK_GRAY": {
    "kind": "color",
    "state": "ok",
    "js": "#444444"
  },
  "DARK_GREY": {
    "kind": "color",
    "state": "missing",
    "alt": "画布不支持——用 hex 字符串"
  },
  "GOLD": {
    "kind": "color",
    "state": "ok",
    "js": "#F0AC5F"
  },
  "GOLD_A": {
    "kind": "color",
    "state": "ok",
    "js": "#F7C797"
  },
  "GOLD_B": {
    "kind": "color",
    "state": "ok",
    "js": "#F9B775"
  },
  "GOLD_C": {
    "kind": "color",
    "state": "ok",
    "js": "#F0AC5F"
  },
  "GOLD_D": {
    "kind": "color",
    "state": "ok",
    "js": "#E1A158"
  },
  "GOLD_E": {
    "kind": "color",
    "state": "ok",
    "js": "#C78D46"
  },
  "GRAY": {
    "kind": "color",
    "state": "ok",
    "js": "#888888"
  },
  "GRAY_A": {
    "kind": "color",
    "state": "ok",
    "js": "#DDDDDD"
  },
  "GRAY_B": {
    "kind": "color",
    "state": "ok",
    "js": "#BBBBBB"
  },
  "GRAY_BROWN": {
    "kind": "color",
    "state": "missing",
    "alt": "画布不支持——用 hex 字符串"
  },
  "GRAY_C": {
    "kind": "color",
    "state": "ok",
    "js": "#888888"
  },
  "GRAY_D": {
    "kind": "color",
    "state": "ok",
    "js": "#444444"
  },
  "GRAY_E": {
    "kind": "color",
    "state": "ok",
    "js": "#222222"
  },
  "GREEN": {
    "kind": "color",
    "state": "ok",
    "js": "#83C167"
  },
  "GREEN_A": {
    "kind": "color",
    "state": "ok",
    "js": "#C9E2AE"
  },
  "GREEN_B": {
    "kind": "color",
    "state": "ok",
    "js": "#A6CF8C"
  },
  "GREEN_C": {
    "kind": "color",
    "state": "ok",
    "js": "#83C167"
  },
  "GREEN_D": {
    "kind": "color",
    "state": "ok",
    "js": "#77B05D"
  },
  "GREEN_E": {
    "kind": "color",
    "state": "ok",
    "js": "#699C52"
  },
  "GREY": {
    "kind": "color",
    "state": "ok",
    "js": "#888888"
  },
  "GREY_A": {
    "kind": "color",
    "state": "ok",
    "js": "#DDDDDD"
  },
  "GREY_B": {
    "kind": "color",
    "state": "ok",
    "js": "#BBBBBB"
  },
  "GREY_BROWN": {
    "kind": "color",
    "state": "ok",
    "js": "#736357"
  },
  "GREY_C": {
    "kind": "color",
    "state": "ok",
    "js": "#888888"
  },
  "GREY_D": {
    "kind": "color",
    "state": "ok",
    "js": "#444444"
  },
  "GREY_E": {
    "kind": "color",
    "state": "ok",
    "js": "#222222"
  },
  "LIGHTER_GRAY": {
    "kind": "color",
    "state": "ok",
    "js": "#DDDDDD"
  },
  "LIGHTER_GREY": {
    "kind": "color",
    "state": "missing",
    "alt": "画布不支持——用 hex 字符串"
  },
  "LIGHT_BROWN": {
    "kind": "color",
    "state": "ok",
    "js": "#CD853F"
  },
  "LIGHT_GRAY": {
    "kind": "color",
    "state": "ok",
    "js": "#BBBBBB"
  },
  "LIGHT_GREY": {
    "kind": "color",
    "state": "missing",
    "alt": "画布不支持——用 hex 字符串"
  },
  "LIGHT_PINK": {
    "kind": "color",
    "state": "ok",
    "js": "#DC75CD"
  },
  "LOGO_BLACK": {
    "kind": "color",
    "state": "missing",
    "alt": "画布不支持——用 hex 字符串"
  },
  "LOGO_BLUE": {
    "kind": "color",
    "state": "missing",
    "alt": "画布不支持——用 hex 字符串"
  },
  "LOGO_GREEN": {
    "kind": "color",
    "state": "missing",
    "alt": "画布不支持——用 hex 字符串"
  },
  "LOGO_RED": {
    "kind": "color",
    "state": "missing",
    "alt": "画布不支持——用 hex 字符串"
  },
  "LOGO_WHITE": {
    "kind": "color",
    "state": "missing",
    "alt": "画布不支持——用 hex 字符串"
  },
  "MAROON": {
    "kind": "color",
    "state": "ok",
    "js": "#C55F73"
  },
  "MAROON_A": {
    "kind": "color",
    "state": "ok",
    "js": "#ECABC1"
  },
  "MAROON_B": {
    "kind": "color",
    "state": "ok",
    "js": "#EC92AB"
  },
  "MAROON_C": {
    "kind": "color",
    "state": "ok",
    "js": "#C55F73"
  },
  "MAROON_D": {
    "kind": "color",
    "state": "ok",
    "js": "#A24D61"
  },
  "MAROON_E": {
    "kind": "color",
    "state": "ok",
    "js": "#94424F"
  },
  "ORANGE": {
    "kind": "color",
    "state": "ok",
    "js": "#FF862F"
  },
  "PINK": {
    "kind": "color",
    "state": "ok",
    "js": "#D147BD"
  },
  "PURE_BLUE": {
    "kind": "color",
    "state": "ok",
    "js": "#0000FF"
  },
  "PURE_CYAN": {
    "kind": "color",
    "state": "missing",
    "alt": "画布不支持——用 hex 字符串"
  },
  "PURE_GREEN": {
    "kind": "color",
    "state": "ok",
    "js": "#00FF00"
  },
  "PURE_MAGENTA": {
    "kind": "color",
    "state": "missing",
    "alt": "画布不支持——用 hex 字符串"
  },
  "PURE_RED": {
    "kind": "color",
    "state": "ok",
    "js": "#FF0000"
  },
  "PURE_YELLOW": {
    "kind": "color",
    "state": "missing",
    "alt": "画布不支持——用 hex 字符串"
  },
  "PURPLE": {
    "kind": "color",
    "state": "ok",
    "js": "#9A72AC"
  },
  "PURPLE_A": {
    "kind": "color",
    "state": "ok",
    "js": "#CAA3E8"
  },
  "PURPLE_B": {
    "kind": "color",
    "state": "ok",
    "js": "#B189C6"
  },
  "PURPLE_C": {
    "kind": "color",
    "state": "ok",
    "js": "#9A72AC"
  },
  "PURPLE_D": {
    "kind": "color",
    "state": "ok",
    "js": "#715582"
  },
  "PURPLE_E": {
    "kind": "color",
    "state": "ok",
    "js": "#644172"
  },
  "RED": {
    "kind": "color",
    "state": "ok",
    "js": "#FC6255"
  },
  "RED_A": {
    "kind": "color",
    "state": "ok",
    "js": "#F7A1A3"
  },
  "RED_B": {
    "kind": "color",
    "state": "ok",
    "js": "#FF8080"
  },
  "RED_C": {
    "kind": "color",
    "state": "ok",
    "js": "#FC6255"
  },
  "RED_D": {
    "kind": "color",
    "state": "ok",
    "js": "#E65A4C"
  },
  "RED_E": {
    "kind": "color",
    "state": "ok",
    "js": "#CF5044"
  },
  "TEAL": {
    "kind": "color",
    "state": "ok",
    "js": "#5CD0B3"
  },
  "TEAL_A": {
    "kind": "color",
    "state": "ok",
    "js": "#ACEAD7"
  },
  "TEAL_B": {
    "kind": "color",
    "state": "ok",
    "js": "#76DDC0"
  },
  "TEAL_C": {
    "kind": "color",
    "state": "ok",
    "js": "#5CD0B3"
  },
  "TEAL_D": {
    "kind": "color",
    "state": "ok",
    "js": "#55C1A7"
  },
  "TEAL_E": {
    "kind": "color",
    "state": "ok",
    "js": "#49A88F"
  },
  "WHITE": {
    "kind": "color",
    "state": "ok",
    "js": "#FFFFFF"
  },
  "YELLOW": {
    "kind": "color",
    "state": "ok",
    "js": "#FFFF00"
  },
  "YELLOW_A": {
    "kind": "color",
    "state": "ok",
    "js": "#FFF1B6"
  },
  "YELLOW_B": {
    "kind": "color",
    "state": "ok",
    "js": "#FFEA94"
  },
  "YELLOW_C": {
    "kind": "color",
    "state": "ok",
    "js": "#FFFF00"
  },
  "YELLOW_D": {
    "kind": "color",
    "state": "ok",
    "js": "#F4D345"
  },
  "YELLOW_E": {
    "kind": "color",
    "state": "ok",
    "js": "#E8C11C"
  },
  "double_smooth": {
    "kind": "rate",
    "state": "ok",
    "js": "doubleSmooth"
  },
  "exponential_decay": {
    "kind": "rate",
    "state": "ok",
    "js": "exponentialDecay",
    "curried": true
  },
  "linear": {
    "kind": "rate",
    "state": "ok",
    "js": "linear"
  },
  "lingering": {
    "kind": "rate",
    "state": "ok",
    "js": "lingering"
  },
  "not_quite_there": {
    "kind": "rate",
    "state": "ok",
    "js": "notQuiteThere",
    "curried": true
  },
  "running_start": {
    "kind": "rate",
    "state": "ok",
    "js": "runningStart",
    "curried": true
  },
  "rush_from": {
    "kind": "rate",
    "state": "ok",
    "js": "rushFrom"
  },
  "rush_into": {
    "kind": "rate",
    "state": "ok",
    "js": "rushInto"
  },
  "slow_into": {
    "kind": "rate",
    "state": "ok",
    "js": "slowInto"
  },
  "smooth": {
    "kind": "rate",
    "state": "ok",
    "js": "smooth"
  },
  "smoothererstep": {
    "kind": "rate",
    "state": "ok",
    "js": "smoothererstep"
  },
  "smootherstep": {
    "kind": "rate",
    "state": "ok",
    "js": "smootherstep"
  },
  "smoothstep": {
    "kind": "rate",
    "state": "ok",
    "js": "smoothstep"
  },
  "squish_rate_func": {
    "kind": "rate",
    "state": "missing",
    "alt": "画布不支持——用 smooth / linear / there_and_back"
  },
  "there_and_back": {
    "kind": "rate",
    "state": "ok",
    "js": "thereAndBack"
  },
  "there_and_back_with_pause": {
    "kind": "rate",
    "state": "ok",
    "js": "thereAndBackWithPause",
    "curried": true
  },
  "wiggle": {
    "kind": "rate",
    "state": "ok",
    "js": "wiggleRate",
    "curried": true
  },
  "shift": {
    "kind": "method",
    "state": "ok",
    "js": "shift",
    "targets": [
      "AnnotationDot",
      "AnnularSector",
      "Annulus",
      "Arc",
      "Arrow",
      "ArrowCircleFilledTip"
    ],
    "hits": 108
  },
  "move_to": {
    "kind": "method",
    "state": "ok",
    "js": "moveTo",
    "targets": [
      "AnnotationDot",
      "AnnularSector",
      "Annulus",
      "Arc",
      "Arrow",
      "ArrowCircleFilledTip"
    ],
    "hits": 112
  },
  "scale": {
    "kind": "method",
    "state": "ok",
    "js": "scale",
    "targets": [
      "AnnotationDot",
      "AnnularSector",
      "Annulus",
      "Arc",
      "Arrow",
      "ArrowCircleFilledTip"
    ],
    "hits": 106
  },
  "rotate": {
    "kind": "method",
    "state": "ok",
    "js": "rotate",
    "targets": [
      "AnnotationDot",
      "AnnularSector",
      "Annulus",
      "Arc",
      "Arrow",
      "ArrowCircleFilledTip"
    ],
    "hits": 106
  },
  "stretch": {
    "kind": "method",
    "state": "ok",
    "js": "stretch",
    "targets": [
      "AnnotationDot",
      "AnnularSector",
      "Annulus",
      "Arc",
      "Arrow",
      "ArrowCircleFilledTip"
    ],
    "hits": 106
  },
  "flip": {
    "kind": "method",
    "state": "ok",
    "js": "flip",
    "targets": [
      "AnnotationDot",
      "AnnularSector",
      "Annulus",
      "Arc",
      "Arrow",
      "ArrowCircleFilledTip"
    ],
    "hits": 106
  },
  "set_fill": {
    "kind": "method",
    "state": "ok",
    "js": "setFill",
    "targets": [
      "AnnotationDot",
      "AnnularSector",
      "Annulus",
      "Arc",
      "Arrow",
      "ArrowCircleFilledTip"
    ],
    "hits": 106
  },
  "set_stroke": {
    "kind": "method",
    "state": "alias",
    "js": "setStyle({ strokeColor, strokeWidth, strokeOpacity })"
  },
  "set_color": {
    "kind": "method",
    "state": "ok",
    "js": "setColor",
    "targets": [
      "AnnotationDot",
      "AnnularSector",
      "Annulus",
      "Arc",
      "Arrow",
      "ArrowCircleFilledTip"
    ],
    "hits": 106
  },
  "set_opacity": {
    "kind": "method",
    "state": "alias",
    "js": "setStrokeOpacity(x) + setFillOpacity(x)"
  },
  "set_style": {
    "kind": "method",
    "state": "ok",
    "js": "setStyle",
    "targets": [
      "AnnotationDot",
      "AnnularSector",
      "Annulus",
      "Arc",
      "Arrow",
      "ArrowCircleFilledTip"
    ],
    "hits": 106
  },
  "next_to": {
    "kind": "method",
    "state": "ok",
    "js": "nextTo",
    "targets": [
      "AnnotationDot",
      "AnnularSector",
      "Annulus",
      "Arc",
      "Arrow",
      "ArrowCircleFilledTip"
    ],
    "hits": 106
  },
  "align_to": {
    "kind": "method",
    "state": "ok",
    "js": "alignTo",
    "targets": [
      "AnnotationDot",
      "AnnularSector",
      "Annulus",
      "Arc",
      "Arrow",
      "ArrowCircleFilledTip"
    ],
    "hits": 106
  },
  "to_edge": {
    "kind": "method",
    "state": "ok",
    "js": "toEdge",
    "targets": [
      "AnnotationDot",
      "AnnularSector",
      "Annulus",
      "Arc",
      "Arrow",
      "ArrowCircleFilledTip"
    ],
    "hits": 106
  },
  "to_corner": {
    "kind": "method",
    "state": "ok",
    "js": "toCorner",
    "targets": [
      "AnnotationDot",
      "AnnularSector",
      "Annulus",
      "Arc",
      "Arrow",
      "ArrowCircleFilledTip"
    ],
    "hits": 106
  },
  "arrange": {
    "kind": "method",
    "state": "ok",
    "js": "arrange",
    "targets": [
      "AnnotationDot",
      "Arrow",
      "DiceFace",
      "DoubleArrow",
      "ManimBanner",
      "MathTexPart"
    ],
    "hits": 14
  },
  "arrange_in_grid": {
    "kind": "method",
    "state": "ok",
    "js": "arrangeInGrid",
    "targets": [
      "AnnotationDot",
      "Arrow",
      "DiceFace",
      "DoubleArrow",
      "ManimBanner",
      "MathTexPart"
    ],
    "hits": 13
  },
  "copy": {
    "kind": "method",
    "state": "ok",
    "js": "copy",
    "targets": [
      "AnnotationDot",
      "AnnularSector",
      "Annulus",
      "Arc",
      "Arrow",
      "ArrowCircleFilledTip"
    ],
    "hits": 104
  },
  "save_state": {
    "kind": "method",
    "state": "ok",
    "js": "saveState",
    "targets": [
      "AnnotationDot",
      "AnnularSector",
      "Annulus",
      "Arc",
      "Arrow",
      "ArrowCircleFilledTip"
    ],
    "hits": 106
  },
  "restore": {
    "kind": "method",
    "state": "ok",
    "js": "restoreState"
  },
  "become": {
    "kind": "method",
    "state": "ok",
    "js": "become",
    "targets": [
      "AnnotationDot",
      "AnnularSector",
      "Annulus",
      "Arc",
      "Arrow",
      "ArrowCircleFilledTip"
    ],
    "hits": 106
  },
  "surround": {
    "kind": "method",
    "state": "missing",
    "alt": "用 get_bounding_box() 取外接框后自建 Rectangle"
  },
  "get_center": {
    "kind": "method",
    "state": "ok",
    "js": "getCenter",
    "targets": [
      "AnnotationDot",
      "AnnularSector",
      "Annulus",
      "Arc",
      "Arrow",
      "ArrowCircleFilledTip"
    ],
    "hits": 107
  },
  "get_bounding_box": {
    "kind": "method",
    "state": "ok",
    "js": "getBoundingBox",
    "targets": [
      "AnnotationDot",
      "AnnularSector",
      "Annulus",
      "Arc",
      "Arrow",
      "ArrowCircleFilledTip"
    ],
    "hits": 106
  },
  "put_start_and_end_on": {
    "kind": "method",
    "state": "alias",
    "js": "putStartAndEndOn(s, e)（Arrow/Vector）/ setStart(s) + setEnd(e)（Line）"
  },
  "set_z_index": {
    "kind": "method",
    "state": "missing",
    "alt": "用 set_z(数值) 设层级"
  },
  "set_x": {
    "kind": "method",
    "state": "ok",
    "js": "setX",
    "targets": [
      "AnnotationDot",
      "AnnularSector",
      "Annulus",
      "Arc",
      "Arrow",
      "ArrowCircleFilledTip"
    ],
    "hits": 106
  },
  "set_y": {
    "kind": "method",
    "state": "ok",
    "js": "setY",
    "targets": [
      "AnnotationDot",
      "AnnularSector",
      "Annulus",
      "Arc",
      "Arrow",
      "ArrowCircleFilledTip"
    ],
    "hits": 106
  },
  "set_z": {
    "kind": "method",
    "state": "ok",
    "js": "setZ",
    "targets": [
      "AnnotationDot",
      "AnnularSector",
      "Annulus",
      "Arc",
      "Arrow",
      "ArrowCircleFilledTip"
    ],
    "hits": 106
  },
  "add_updater": {
    "kind": "method",
    "state": "ok",
    "js": "addUpdater",
    "targets": [
      "AnnotationDot",
      "AnnularSector",
      "Annulus",
      "Arc",
      "Arrow",
      "ArrowCircleFilledTip"
    ],
    "hits": 106
  },
  "remove_updater": {
    "kind": "method",
    "state": "ok",
    "js": "removeUpdater",
    "targets": [
      "AnnotationDot",
      "AnnularSector",
      "Annulus",
      "Arc",
      "Arrow",
      "ArrowCircleFilledTip"
    ],
    "hits": 106
  },
  "clear_updaters": {
    "kind": "method",
    "state": "ok",
    "js": "clearUpdaters",
    "targets": [
      "AnnotationDot",
      "AnnularSector",
      "Annulus",
      "Arc",
      "Arrow",
      "ArrowCircleFilledTip"
    ],
    "hits": 106
  },
  "get_updaters": {
    "kind": "method",
    "state": "ok",
    "js": "getUpdaters",
    "targets": [
      "AnnotationDot",
      "AnnularSector",
      "Annulus",
      "Arc",
      "Arrow",
      "ArrowCircleFilledTip"
    ],
    "hits": 106
  },
  "animate": {
    "kind": "method",
    "state": "alias",
    "js": "play(m.animate.x(...))",
    "alt": "animate 链可用，但只覆盖这组方法：with_duration / with_rate_func / shift / move_to / rotate / scale / set_color / set_opacity / set_stroke_width / set_fill_opacity / set_fill / set_style / flip / center / next_to / align_to / to_edge / set_x / set_y / set_z；没有的方法（如 set_value）得换写法",
    "targets": [
      "circle"
    ],
    "hits": 1
  },
  "get_start": {
    "kind": "method",
    "state": "ok",
    "js": "getStart",
    "targets": [
      "Arc",
      "Arrow",
      "DashedLine",
      "DoubleArrow",
      "Line",
      "Mobject1D"
    ],
    "hits": 9
  },
  "get_end": {
    "kind": "method",
    "state": "ok",
    "js": "getEnd",
    "targets": [
      "Arc",
      "Arrow",
      "DashedLine",
      "DoubleArrow",
      "Line",
      "Mobject1D"
    ],
    "hits": 9
  },
  "put_start_and_end": {
    "kind": "method",
    "state": "missing",
    "alt": "用 put_start_and_end_on(a, b)，或 set_start(a) + set_end(b)"
  },
  "plot": {
    "kind": "method",
    "state": "ok",
    "js": "plot",
    "targets": [
      "Axes",
      "ComplexPlane",
      "NumberPlane"
    ],
    "hits": 3
  },
  "plot_parametric_curve": {
    "kind": "method",
    "state": "missing",
    "alt": "用 plot() 画按参数方程采样好的点"
  },
  "plot_line_graph": {
    "kind": "method",
    "state": "ok",
    "js": "plotLineGraph",
    "targets": [
      "Axes",
      "ComplexPlane",
      "NumberPlane"
    ],
    "hits": 3
  },
  "get_axis_labels": {
    "kind": "method",
    "state": "ok",
    "js": "getAxisLabels",
    "targets": [
      "Axes",
      "ComplexPlane",
      "NumberPlane",
      "ThreeDAxes"
    ],
    "hits": 4
  },
  "c2p": {
    "kind": "method",
    "state": "ok",
    "js": "c2p",
    "targets": [
      "Axes",
      "ComplexPlane",
      "NumberPlane",
      "ThreeDAxes"
    ],
    "hits": 4
  },
  "coords_to_point": {
    "kind": "method",
    "state": "ok",
    "js": "coordsToPoint",
    "targets": [
      "Axes",
      "ComplexPlane",
      "NumberPlane",
      "ThreeDAxes"
    ],
    "hits": 4
  },
  "get_graph_label": {
    "kind": "method",
    "state": "ok",
    "js": "getGraphLabel",
    "targets": [
      "Axes",
      "ComplexPlane",
      "NumberPlane"
    ],
    "hits": 3
  },
  "get_area": {
    "kind": "method",
    "state": "ok",
    "js": "getArea",
    "targets": [
      "AnnularSector",
      "Annulus",
      "Axes",
      "Circle",
      "ComplexPlane",
      "Dot"
    ],
    "hits": 23
  },
  "get_riemann_rectangles": {
    "kind": "method",
    "state": "ok",
    "js": "getRiemannRectangles",
    "targets": [
      "Axes",
      "ComplexPlane",
      "NumberPlane"
    ],
    "hits": 3
  },
  "input_to_graph_point": {
    "kind": "method",
    "state": "ok",
    "js": "inputToGraphPoint",
    "targets": [
      "Axes",
      "ComplexPlane",
      "NumberPlane"
    ],
    "hits": 3
  },
  "plot_derivative_graph": {
    "kind": "method",
    "state": "missing",
    "alt": "用 plot() 画手算好的导数"
  },
  "get_part_by_tex": {
    "kind": "method",
    "state": "missing",
    "alt": "MathTex 取段用 m[i]（manim-web 只有 getPart(序号)，没有按 tex 找）"
  },
  "get_parts": {
    "kind": "method",
    "state": "ok",
    "js": "getParts",
    "targets": [
      "MathTexPart"
    ],
    "hits": 1
  },
  "m[i]": {
    "kind": "method",
    "state": "alias",
    "js": "getPart(i)（MathTex 取段）"
  },
  "set_value": {
    "kind": "method",
    "state": "ok",
    "js": "setValue",
    "targets": [
      "ComplexValueTracker",
      "DecimalNumber",
      "DiceFace",
      "Integer",
      "ValueTracker",
      "complexValueTracker"
    ],
    "hits": 7
  },
  "get_value": {
    "kind": "method",
    "state": "ok",
    "js": "getValue",
    "targets": [
      "ComplexValueTracker",
      "DecimalNumber",
      "DiceFace",
      "Integer",
      "ValueTracker",
      "complexValueTracker"
    ],
    "hits": 7
  },
  "interpolate": {
    "kind": "method",
    "state": "ok",
    "js": "interpolate",
    "targets": [
      "Add",
      "AddTextLetterByLetter",
      "AddTextWordByWord",
      "AnnotationDot",
      "AnnularSector",
      "Annulus"
    ],
    "hits": 176
  },
  "play": {
    "kind": "scene-method",
    "state": "ok",
    "js": "play",
    "targets": [
      "scene"
    ],
    "hits": 1
  },
  "add": {
    "kind": "scene-method",
    "state": "ok",
    "js": "add",
    "targets": [
      "scene"
    ],
    "hits": 1
  },
  "remove": {
    "kind": "scene-method",
    "state": "ok",
    "js": "remove",
    "targets": [
      "scene"
    ],
    "hits": 1
  },
  "wait": {
    "kind": "scene-method",
    "state": "ok",
    "js": "wait",
    "targets": [
      "scene"
    ],
    "hits": 1
  },
  "clear": {
    "kind": "scene-method",
    "state": "ok",
    "js": "clear",
    "targets": [
      "scene"
    ],
    "hits": 1
  },
  "bring_to_front": {
    "kind": "method",
    "state": "missing",
    "alt": "用 set_z(较大值) 提到上层（manim-web 没有 Scene 级层级重排）"
  },
  "bring_to_back": {
    "kind": "method",
    "state": "missing",
    "alt": "用 set_z(较小值) 压到下层"
  }
}

export const PY_COLOR_HEX: Record<string, string> = {
  "BLACK": "#000000",
  "BLUE": "#58C4DD",
  "BLUE_A": "#C7E9F1",
  "BLUE_B": "#9CDCEB",
  "BLUE_C": "#58C4DD",
  "BLUE_D": "#29ABCA",
  "BLUE_E": "#236B8E",
  "DARKER_GRAY": "#222222",
  "DARK_BLUE": "#236B8E",
  "DARK_BROWN": "#8B4513",
  "DARK_GRAY": "#444444",
  "GOLD": "#F0AC5F",
  "GOLD_A": "#F7C797",
  "GOLD_B": "#F9B775",
  "GOLD_C": "#F0AC5F",
  "GOLD_D": "#E1A158",
  "GOLD_E": "#C78D46",
  "GRAY": "#888888",
  "GRAY_A": "#DDDDDD",
  "GRAY_B": "#BBBBBB",
  "GRAY_C": "#888888",
  "GRAY_D": "#444444",
  "GRAY_E": "#222222",
  "GREEN": "#83C167",
  "GREEN_A": "#C9E2AE",
  "GREEN_B": "#A6CF8C",
  "GREEN_C": "#83C167",
  "GREEN_D": "#77B05D",
  "GREEN_E": "#699C52",
  "GREY": "#888888",
  "GREY_A": "#DDDDDD",
  "GREY_B": "#BBBBBB",
  "GREY_BROWN": "#736357",
  "GREY_C": "#888888",
  "GREY_D": "#444444",
  "GREY_E": "#222222",
  "LIGHTER_GRAY": "#DDDDDD",
  "LIGHT_BROWN": "#CD853F",
  "LIGHT_GRAY": "#BBBBBB",
  "LIGHT_PINK": "#DC75CD",
  "MAROON": "#C55F73",
  "MAROON_A": "#ECABC1",
  "MAROON_B": "#EC92AB",
  "MAROON_C": "#C55F73",
  "MAROON_D": "#A24D61",
  "MAROON_E": "#94424F",
  "ORANGE": "#FF862F",
  "PINK": "#D147BD",
  "PURE_BLUE": "#0000FF",
  "PURE_GREEN": "#00FF00",
  "PURE_RED": "#FF0000",
  "PURPLE": "#9A72AC",
  "PURPLE_A": "#CAA3E8",
  "PURPLE_B": "#B189C6",
  "PURPLE_C": "#9A72AC",
  "PURPLE_D": "#715582",
  "PURPLE_E": "#644172",
  "RED": "#FC6255",
  "RED_A": "#F7A1A3",
  "RED_B": "#FF8080",
  "RED_C": "#FC6255",
  "RED_D": "#E65A4C",
  "RED_E": "#CF5044",
  "TEAL": "#5CD0B3",
  "TEAL_A": "#ACEAD7",
  "TEAL_B": "#76DDC0",
  "TEAL_C": "#5CD0B3",
  "TEAL_D": "#55C1A7",
  "TEAL_E": "#49A88F",
  "WHITE": "#FFFFFF",
  "YELLOW": "#FFFF00",
  "YELLOW_A": "#FFF1B6",
  "YELLOW_B": "#FFEA94",
  "YELLOW_C": "#FFFF00",
  "YELLOW_D": "#F4D345",
  "YELLOW_E": "#E8C11C"
}

/** m.animate.<方法>(...) 可链的方法（snake_case；适配层据此做 snake→camel 映射与拦错）。 */
export const PY_ANIMATE_METHODS: string[] = [
  "with_duration",
  "with_rate_func",
  "shift",
  "move_to",
  "rotate",
  "scale",
  "set_color",
  "set_opacity",
  "set_stroke_width",
  "set_fill_opacity",
  "set_fill",
  "set_style",
  "flip",
  "center",
  "next_to",
  "align_to",
  "to_edge",
  "set_x",
  "set_y",
  "set_z"
]
