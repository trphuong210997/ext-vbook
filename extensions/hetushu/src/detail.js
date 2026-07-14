load("config.js");

function execute(url) {
    url = hetuNormalizeUrl(url);
    var doc = hetuGetDoc(url);
    if (!doc || hetuIsChallenge(doc)) {
        return Response.error(
            "Cloudflare chua qua. Mo https://m.hetushu.com tren trinh duyet dien thoai, hoan thanh security check, roi chay lai. "
            + hetuDebugDoc(doc)
        );
    }

    var nameEl = doc.select("h2").first();
    if (!nameEl) nameEl = doc.select(".book_info h2, .bookname").first();
    var name = (nameEl ? nameEl.text() : "") + "";

    var cover = "";
    var coverEl = doc.select("img").first();
    if (coverEl) {
        cover = (coverEl.attr("data-src") || coverEl.attr("src") || "") + "";
        cover = hetuAbsUrl(cover);
    }

    var author = "";
    var infoText = (doc.select("body").text() || "") + "";
    var authorMatch = infoText.match(/作者\s*[:：]\s*([^\n类型字数]+)/);
    if (authorMatch) author = authorMatch[1].trim();

    if (!author) {
        doc.select("a").forEach(function (el) {
            if (author) return;
            var href = (el.attr("href") || "") + "";
            if (href.indexOf("/author/") > -1) author = (el.text() || "") + "";
        });
    }

    var ongoing = infoText.indexOf("完结") === -1
        && infoText.indexOf("完本") === -1
        && infoText.indexOf("Completed") === -1;

    var description = "";
    var descEl = doc.select(".intro, #intro, .book_intro, .summary").first();
    if (descEl) description = (descEl.html() || "") + "";
    if (!description) {
        var parts = infoText.split("作品简介");
        if (parts.length > 1) description = parts[1].trim();
    }

    if (!name) return Response.error("Book title not found: " + hetuDebugDoc(doc));

    return Response.success({
        name: name,
        cover: cover,
        host: BASE_URL,
        author: author,
        description: description,
        ongoing: ongoing
    });
}
