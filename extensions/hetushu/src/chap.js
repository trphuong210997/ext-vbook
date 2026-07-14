load("config.js");

function execute(url) {
    url = hetuNormalizeUrl(url);
    var doc = hetuGetChapterDoc(url);
    if (!doc || hetuIsChallenge(doc)) {
        return Response.error("Cannot load chapter: " + hetuDebugDoc(doc));
    }

    var content = hetuExtractChapterHtml(doc);
    if (!content || content.length < 50) {
        return Response.error("Chapter content empty: " + hetuDebugDoc(doc));
    }

    return Response.success(content);
}
