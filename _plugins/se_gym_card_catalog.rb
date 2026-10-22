require 'json'
require 'digest'

module Jekyll
  # The catalog carries the fields needed for selection, legacy statistics,
  # skipped-question review, and saved workouts. Answers load only for practice.
  class SEGymCardCatalog < Generator
    safe true
    priority :low

    COLLECTIONS = { 'quizzes' => 'questions', 'flashcards' => 'cards' }.freeze
    METADATA_FIELDS = %w[id sourceDeckId question difficulty type program].freeze

    def generate(site)
      @site = site
      @markdown = site.find_converter_instance(Jekyll::Converters::Markdown)
      catalog = {}
      urls = {}
      master_decks = {}
      COLLECTIONS.each do |collection, field|
        catalog[collection], urls[collection], master_decks[collection] = build_collection(collection, field)
      end
      site.data['se_gym_card_catalog'] = catalog
      site.data['se_gym_deck_urls'] = urls
      site.data['se_gym_master_decks'] = master_decks
      # Incremental Jekyll builds do not otherwise track site.data dependencies.
      site.pages.each do |page|
        page.data['regenerate'] = true if page.content.include?('include se-gym-card-data.html')
      end
    end

    private

    def build_collection(collection, field)
      source = @site.data.fetch(collection, {})
      catalog = {}
      urls = {}
      masters = {}
      source.each do |id, deck|
        next unless deck[field] || deck['decks']

        metadata = { 'title' => deck['title'], 'description' => default(deck['description'], '') }
        if deck[field]
          cards = deck[field].map { |card| render_card(collection, id, card) }
          catalog[id] = metadata.merge(field => cards.map { |card| card.slice(*METADATA_FIELDS) })
          urls[id] = emit_deck(collection, id, metadata.merge(field => cards))
        else
          catalog[id] = metadata.merge('isMaster' => true, field => [])
          # Preserve existing semantics: only direct references to base decks
          # contribute; unavailable or nested aggregate references are ignored.
          masters[id] = deck['decks'].select { |source_id| source[source_id] && source[source_id][field] }
        end
      end
      [catalog, urls, masters]
    end

    def render_card(collection, source_id, card)
      common = {
        'id' => card['id'], 'sourceDeckId' => source_id,
        'question' => markdown(card['question']),
        'difficulty' => card['difficulty'].to_s.downcase
      }
      collection == 'quizzes' ? common.merge(render_quiz(card)) : common.merge(render_flashcard(card))
    end

    def render_quiz(card)
      quiz = {
        'type' => default(card['type'], 'single'),
        'options' => Array(card['options']).map { |option| markdown(option) },
        'correct_index' => card['correct_index'], 'correct_indices' => card['correct_indices'],
        'optional_indices' => card['optional_indices'],
        'option_feedback' => (card['option_feedback'] || {}).to_h { |key, text| [key.to_s, markdown(text)] },
        'explanation' => card['type'] == 'write-in' ? default(card['explanation'], '') : markdown(default(card['explanation'], '')),
        'lines' => card['lines'], 'interchangeable' => card['interchangeable'], 'distractors' => card['distractors'],
        'display' => default(card['display'], 'block')
      }
      if card['type'] == 'write-in'
        %w[program answer answer_prompt].each { |field| quiz[field] = card[field] }
      end
      quiz
    end

    def render_flashcard(card)
      {
        'hint' => markdown(default(card['hint'], '').strip).strip,
        'answer' => markdown(card['answer']),
        'explanation' => markdown(default(card['explanation'], ''))
      }
    end

    def markdown(value)
      @markdown.convert(value.to_s)
    end

    def default(value, fallback)
      value.nil? || value == false || (value.respond_to?(:empty?) && value.empty?) ? fallback : value
    end

    def emit_deck(collection, id, deck)
      json = JSON.generate(deck)
      digest = Digest::SHA256.hexdigest(json)[0, 16]
      directory = "assets/se-gym-decks/#{collection}"
      filename = "#{id}-#{digest}.json"
      page = PageWithoutAFile.new(@site, @site.source, directory, filename)
      page.content = json
      page.data.merge!('layout' => nil, 'render_with_liquid' => false, 'sitemap' => false, 'regenerate' => true)
      @site.pages << page
      "#{@site.baseurl}/#{directory}/#{filename}"
    end
  end
end
