load("crypto.js");
load("config.js");

function execute(url) {
    url = hetuNormalizeUrl(url);
    var content = hetuGetChapterContent(url);
    if (!content || content.length < 50) {
        return Response.error("Cannot load chapter (fetch+reorder failed)");
    }
    return Response.success(content);
}
