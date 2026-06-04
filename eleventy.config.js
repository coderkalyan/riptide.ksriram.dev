export default function(eleventyConfig) {
    eleventyConfig.addPassthroughCopy("src/assets");

    return {
        dir: {
            input: "src",
            includes: "_includes",
            layouts: "_includes",
            output: "_site",
        },
        markdownTemplateEngine: "njk",
        htmlTemplateEngine: "njk",
    };
}
