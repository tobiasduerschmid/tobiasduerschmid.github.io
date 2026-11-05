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
#   - a narration topic, named by `topic="..."` on an include (a chapter's
#     `{% include narration.html topic="..." %}`) or by `topic:` / `narration:`
#     frontmatter (reader, print, notes, and stage views)
#       → _data/narrations/<topic>.yml, _data/narration_visuals/<topic>.json,
#         and its _data/explainers/<topic>_{notes,timing,code,quizzes,ui} files

module Jekyll
  module DataRegenerator
    QUIZ_INCLUDE_RE       = /\{%\s*include\s+quiz\.html\s+id=["']([^"']+)["']/
    FLASHCARDS_INCLUDE_RE = /\{%\s*include\s+flashcards\.html\s+id=["']([^"']+)["']/
    TOPIC_INCLUDE_RE      = /\{%-?\s*include\s+[\w.-]+\s[^%]*?\btopic=["']([^"']+)["']/
    # The per-lesson companions that narration includes read from _data/explainers/.
    NARRATION_COMPANIONS  = %w[notes timing code quizzes ui]
    AUTO_ABBR_LAYOUTS      = %w[sebook sebook-combined tutorial print-tutorial blog-post]

    def self.collect_deps(doc, source)
      deps = []

      if (tut = doc.data["tutorial"])
        deps << File.join(source, "_data", "tutorials", "#{tut}.yml")
      end

      if AUTO_ABBR_LAYOUTS.include?(doc.data["layout"].to_s)
        deps << File.join(source, "_data", "glossary.yml")
      end

      content = doc.respond_to?(:content) ? doc.content.to_s : ""
      content.scan(QUIZ_INCLUDE_RE).each do |m|
        deps << File.join(source, "_data", "quizzes", "#{m[0]}.yml")
      end
      content.scan(FLASHCARDS_INCLUDE_RE).each do |m|
        deps << File.join(source, "_data", "flashcards", "#{m[0]}.yml")
      end
      narration_topics(doc, content).each do |topic|
        deps.concat(narration_deps(source, topic))
      end

      deps.select { |p| File.exist?(p) }
    end

    def self.narration_topics(doc, content)
      named = [doc.data["topic"], doc.data["narration"]].compact.map(&:to_s)
      (named + content.scan(TOPIC_INCLUDE_RE).flatten).uniq
    end

    # A topic is a narration lesson only when its script exists; other `topic`
    # values add nothing.
    def self.narration_deps(source, topic)
      script = File.join(source, "_data", "narrations", "#{topic}.yml")
      return [] unless File.exist?(script)

      companions = NARRATION_COMPANIONS.product(%w[yml json]).map do |name, extension|
        File.join(source, "_data", "explainers", "#{topic}_#{name}.#{extension}")
      end
      [script, File.join(source, "_data", "narration_visuals", "#{topic}.json")] + companions
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
