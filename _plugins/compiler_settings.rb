require 'json'

# Authored compiler files share one representation between the live editor and
# the static print view. Parsing does not execute any learner-authored code.
module CompilerSettingsFilter
  def compiler_settings(input)
    settings = JSON.parse(input)
    unless settings.is_a?(Hash) && settings['tokenRules'].is_a?(Array)
      raise Liquid::ArgumentError, 'Compiler settings must contain a tokenRules array.'
    end
    settings
  rescue JSON::ParserError => error
    raise Liquid::ArgumentError, "Invalid compiler tokenizer JSON: #{error.message}"
  end
end

Liquid::Template.register_filter(CompilerSettingsFilter)
