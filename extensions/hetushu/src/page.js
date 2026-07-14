load("config.js");

function execute(url) {
    url = hetuNormalizeUrl(url);
    if (url.slice(-1) === "/") url = url.slice(0, -1);

    var bookId = hetuBookId(url);
    if (!bookId) return Response.success([url]);

    var indexUrl = BASE_URL + "/book/" + bookId + "/index.html";
    var doc = hetuGetDoc(indexUrl);
    if (!doc || hetuIsChallenge(doc)) {
        return Response.success([indexUrl]);
    }

    var pages = hetuCollectTocPageUrls(indexUrl, doc);
    return Response.success(pages);
}
