# 看板 Banner 素材池

生成看板页时，从腾讯 COS 目录素材池中随机选择一张图片作为 Banner 图片。

COS 素材目录：

- Bucket：`ai-1259627966`
- Region：`ap-shanghai`
- Public base URL：`https://ai-1259627966.cos.ap-shanghai.myqcloud.com`
- Prefix：`前端资源目录/`
- 示例图片：`https://ai-1259627966.cos.ap-shanghai.myqcloud.com/%E5%89%8D%E7%AB%AF%E8%B5%84%E6%BA%90%E7%9B%AE%E5%BD%95/image-2%403x.png`

获取规则：

1. 通过 COS ListObjects/ListObjectsV2 读取 `前端资源目录/` 下的文件列表。
2. 只保留图片文件：`.png`、`.jpg`、`.jpeg`、`.webp`。
3. 从可用图片中随机选取 1 张作为当前看板 Banner。
4. 使用图片的可直接访问 URL 作为独立 `<img>` 节点。
5. `<img>` 必须设置 `width: 100%`、`height: auto`，让原图按屏幕宽度等比完整展示。
6. 不要使用 CSS `background-image`、`background-size: cover`、`object-fit: cover` 或固定高度裁剪容器。
7. 不要固定只使用示例图片；示例图片只用于验证路径格式。
8. 如果运行环境配置了访问域名替换，可将 COS 域名替换为业务 CDN 域名，但图片路径必须保持一致。

安全规则：

- 不要把 COS `secretId`、`secretKey`、STS 临时凭证写入 skill 文档、页面代码或提示词。
- 调用 COS 列表接口时，从运行环境、业务配置或临时 STS 服务读取凭证。
- 如果当前环境无法列出 COS 目录，不要编造文件清单；应说明无法读取目录，或临时使用示例图片作为占位。
