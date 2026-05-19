# Removes stale incremental-build dependencies left by older quiz/flashcard
# includes that inlined the full SE Gym hero SVG on every widget page.

module Jekyll
  module SEGymHeroDependencyPruner
    DIRECT_HERO_INCLUDE_RE = /\{%\s*include\s+se-gym-hero\.svg\b/
    LAYOUTS_WITH_INLINE_HERO = %w[tutorial]

    def self.legitimate_hero_dependency?(doc)
      return true if LAYOUTS_WITH_INLINE_HERO.include?(doc.data["layout"].to_s)

      content = doc.respond_to?(:content) ? doc.content.to_s : ""
      content.match?(DIRECT_HERO_INCLUDE_RE)
    end

    def self.prune(site)
      regenerator = site.regenerator
      return unless regenerator

      hero_path = File.join(site.source, "_includes", "se-gym-hero.svg")
      (site.pages + site.documents).each do |doc|
        source_path = site.in_source_dir(doc.relative_path)
        metadata = regenerator.metadata[source_path]
        deps = metadata && metadata["deps"]

        next if legitimate_hero_dependency?(doc)

        next unless deps

        deps.delete(hero_path)
      end
    end
  end
end

Jekyll::Hooks.register :site, :post_read do |site|
  Jekyll::SEGymHeroDependencyPruner.prune(site)
end
