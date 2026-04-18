# Extends Jekyll's incremental build to track dependencies on _data/ files.
# Jekyll's built-in regenerator tracks layouts and includes but not site.data.*,
# so pages consuming tutorials/quizzes/flashcards YAML are not re-rendered when
# the underlying data changes. This plugin registers those dependencies so
# `jekyll build --incremental` picks up edits on the next run.
#
# Dependencies are discovered automatically:
#   - `tutorial: <name>` frontmatter → _data/tutorials/<name>.yml
#   - `{% include quiz.html id="..." %}` → _data/quizzes/<id>.yml
#   - `{% include flashcards.html id="..." %}` → _data/flashcards/<id>.yml

module Jekyll
  module DataRegenerator
    QUIZ_INCLUDE_RE       = /\{%\s*include\s+quiz\.html\s+id=["']([^"']+)["']/
    FLASHCARDS_INCLUDE_RE = /\{%\s*include\s+flashcards\.html\s+id=["']([^"']+)["']/

    def self.collect_deps(doc, source)
      deps = []

      if (tut = doc.data["tutorial"])
        deps << File.join(source, "_data", "tutorials", "#{tut}.yml")
      end

      content = doc.respond_to?(:content) ? doc.content.to_s : ""
      content.scan(QUIZ_INCLUDE_RE).each do |m|
        deps << File.join(source, "_data", "quizzes", "#{m[0]}.yml")
      end
      content.scan(FLASHCARDS_INCLUDE_RE).each do |m|
        deps << File.join(source, "_data", "flashcards", "#{m[0]}.yml")
      end

      deps.select { |p| File.exist?(p) }
    end

    def self.register(site)
      regenerator = site.regenerator
      return unless regenerator

      (site.pages + site.documents).each do |doc|
        # Use the same key Jekyll's regenerator uses for lookup:
        # regenerate_page? / regenerate_document? both resolve to the absolute
        # source path via site.in_source_dir(doc.relative_path). doc.path is
        # relative for Page but absolute for Document, so it doesn't match.
        path = site.in_source_dir(doc.relative_path)
        next unless File.exist?(path)

        deps = collect_deps(doc, site.source)
        next if deps.empty?

        regenerator.add(path) unless regenerator.metadata[path]
        deps.each { |dep| regenerator.add_dependency(path, dep) }
      end
    end
  end
end

Jekyll::Hooks.register :site, :post_read do |site|
  Jekyll::DataRegenerator.register(site)
end
