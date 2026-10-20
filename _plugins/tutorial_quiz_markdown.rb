# Tutorial quizzes use the same Markdown converter and language lexers as lessons.
# Keep raw Markdown for grading, exports, and the runtime fallback; the rendered
# lookup travels with the quiz so shuffling and popouts need no special handling.
module TutorialQuizMarkdownFilter
  def with_quiz_markdown(tutorial)
    converter = @context.registers[:site].find_converter_instance(Jekyll::Converters::Markdown)
    steps = tutorial.fetch('steps', []).map do |step|
      quiz = step['quiz']
      next step unless quiz

      texts = quiz.fetch('questions', []).flat_map do |question|
        feedback = question.fetch('option_feedback', {})
        [question['question'], question['explanation']] +
          question.fetch('options', []) + (feedback.is_a?(Hash) ? feedback.values : Array(feedback))
      end
      rendered = texts.grep(String).uniq.to_h { |text| [text, converter.convert(text)] }
      step.merge('quiz' => quiz.merge('renderedMarkdown' => rendered))
    end
    tutorial.merge('steps' => steps)
  end
end

Liquid::Template.register_filter(TutorialQuizMarkdownFilter)
