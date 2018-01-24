# wait-module
1.支持json引用资源库地址。<br />
2.支持cdn模式，优先加载cdn路径文件，自动判断cdn资源是否有效，加载失败（404）自动依次从数组开始往后加载，直至src地址失败抛出异常。<br />
3.支持模块共享数据。例如有个storages模块，在require时需要和其他module共享数据。require("!storages");即可。<br />
4.只在设计上遵循了AMD规范，但是使用上却使用了类似CMD规范。我和我的团队都喜欢在require时暴露出过程，会比较灵活。可以伴随逻辑require，而不是预先require好资源再执行。<br />
5.目前只支持到ie8。<br />
6.暂时不支持加载css资源和html资源。
