我想要基于Comlink实现一个WebSDK，后续发布到CDN，允许外部直接导入
* 对于外部没有在我的网站下使用，默认提供empty实现
* 外部可以手动指定使用test模式来切换模式从而避免使用empty实现，方便本地测试
* 在网站下面，我会动态替换相关的实现，但是要保持 webserver/frontend/lib/creatify-open-sdk 独立，这部分的实现实际上是在 webserver/frontend/feature/creatify-open-sdk 编写，所以需要考虑到动态替换方式

相关指引：
- webserver/frontend/lib/creatify-open-sdk

请给我一些组织方案,先不要写代码