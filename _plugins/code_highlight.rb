require 'rouge'

module CodeHighlightFilter
  class LineFormatter < Rouge::Formatters::HTML
    def lines(tokens)
      token_lines(tokens).map { |line| format(line) }
    end
  end

  # Lex the entire snippet before splitting, preserving multiline token context.
  # Rouge escapes source text; Liquid owns the surrounding editor markup.
  def highlight_code_lines(source, language = 'javascript')
    lexer = Rouge::Lexer.find(language).new
    LineFormatter.new.lines(lexer.lex(source))
  end
end

Liquid::Template.register_filter(CodeHighlightFilter)
