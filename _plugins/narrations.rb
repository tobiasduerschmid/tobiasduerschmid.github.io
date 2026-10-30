# One compiler is shared by Jekyll, audio rendering, and content tests. Keep the
# renderer-facing data shape stable while authors edit the versioned script.
require 'json'
require 'open3'
Jekyll::Hooks.register :site, :post_read do |site|
  output, errors, status = Open3.capture3('node', File.join(site.source, 'scripts/narration.js'), 'compile', chdir: site.source)
  raise Jekyll::Errors::FatalException, "Narration compilation failed: #{errors}" unless status.success?
  lessons = JSON.parse(output)
  site.data['narration_lessons'] = lessons
  site.data['explainers'] ||= {}
  site.data['video_narrations'] = {}
  site.data['narrated_patterns'] = {}
  lessons.each do |id, lesson|
    site.data['explainers'][id] = lesson.fetch('story')
    registry = { 'video' => 'video_narrations', 'pattern' => 'narrated_patterns' }[lesson['kind']]
    site.data[registry][id] = lesson.fetch('lesson') if registry
  end
end
