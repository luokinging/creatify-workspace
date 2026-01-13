DEMO参考模块路径：.doc/asset/demo
修改的模块对应路由： /tool/cta-generator

bugfix
* 当我点击Live Copy部分的 Top / Bottom segment进行切换的时候，copy位置正确变化，但是当同时开启 conversion widgets的时候，conversion widgets位置不正确
* logo遮挡了copy文字，当存在logo的时候，文字应该在logo下方（文字top展示的情况下）

请参考demo的实现，查看demo是怎么做的然后为我修复



---

Demo VISUALS 标题右侧的segment，请参考其样式在当前模块中新增一个 SoftSegment组件，并将 1. PRODUCT下方的 radio group替换微SoftSegment

<SoftSegment value=x onValueChange=x>
<SoftSegmentItem value=x>xxx</SoftSegmentItem>
</SoftSegment>

参考demo中 2. LIVE COPY 部分的排版，为我更新模块 LIVE COPY的排版，要和demo一致，并增加 Top / Bottom segment，用soft segment，size=sm，SoftSegment 样式上不需要边框

参考demo中的 CONVERSION WIDGETS，为我在模块的LIVE COPY下面也增加CONVERSION WIDGETS，不需要实现具体功能，只处理展示就好，注意组件抽取和拆分


之前LIVE COPY的预览是通过调用后端接口生成背景图再展示在preview上，现在要做如下改动
* LIVE COPY的实现参考demo，使用前端实时渲染的方式实现，不再依赖后端（即使还没有背景图也展示,和demo一样）
* 可以通过切换bottom / top segment来切换展示位置
* 通过修改Visual Vibe可以实时更改文字样式、动画（暂时只考虑这两部分）


预览区域图片展示
左侧控制面板有三个产品来源，分别是Manually / Select Product / Enter URL，其中
* Manually不需要从后端获取背景图
* Select Product和Enter URL可以从后端获取背景图

对于不需要获取背景图的产品来源，PRODUCT IMAGE就是用户上传的图片，
对于允许获取背景图的产品来源，当用户点击Analyze（已经存在相关逻辑）后获取图片后，覆盖掉原来的背景图即可（如果存在）

现在请你参考demo，为我实现

* 背景图片预览：
    Manually的情况下：
    * 用户选择Product Image，立即同步到预览区域，这里需要特别注意Manually 其实是对应demo中的 Original visual，注意图片处理方式是 object-center + object+contain + 虚化背景的效果
    * Select Product / Enter URL情况下：
    当分析出结果以后，把后端给的背景图片展示在左侧对应区域以及同步到预览区域

* Logo预览：
    参考demo的实现，为我实现包括Size、Original/Magic Remove / White / Black 调整在内的功能

注意：
* 如果存在不确定的，请先询问我，和我对齐
* 也许需要做任务拆分