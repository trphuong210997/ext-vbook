load("config.js");

function execute(url) {
    url = hetuNormalizeUrl(url);
    if (url.slice(-1) === "/") url = url.slice(0, -1);

    var bookId = hetuBookId(url);
    var chapters = [];
    var seen = {};

    if (bookId && url.indexOf("index.html") > -1) {
        chapters = hetuFetchDirJson(bookId);
        for (var i = 0; i < chapters.length; i++) {
            seen[chapters[i].url] = true;
        }
    }

    var doc = null;

    if (chapters.length === 0) {
        doc = hetuGetDoc(url);
        if (!doc || hetuIsChallenge(doc)) {
            return Response.error("Cannot load TOC: " + hetuDebugDoc(doc));
        }
        chapters = hetuParseChaptersFromDoc(doc, bookId, seen, chapters);
    }

    if (chapters.length === 0) {
        return Response.error("No chapters found: " + hetuDebugDoc(doc));
    }

    return Response.success(chapters);
}
