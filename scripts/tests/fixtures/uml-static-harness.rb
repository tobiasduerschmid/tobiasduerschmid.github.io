require 'digest'
require 'json'
require 'tmpdir'

# The plugin only needs the hook and logger surfaces while these focused unit
# tests exercise its HTML transformation contract.
module Jekyll
  class TestLogger
    def warn(*) end
    def error(*) end
  end

  def self.logger
    @logger ||= TestLogger.new
  end

  module Hooks
    def self.register(*) end
  end
end

require_relative '../../../_plugins/uml_static'

def cache_key(renderer_hash, block)
  Digest::MD5.hexdigest("#{renderer_hash}|#{block[:type]}|#{block[:text]}")
end

# The stub describer answers with no descriptions; the real one is the
# browser describer the production build runs through Node.
def describer_command(describer)
  return ['ruby', File.join(__dir__, 'uml-static-describer-stub.rb')] unless describer == 'real'

  ['node', File.expand_path('../../../js/uml-describe-cli.js', __dir__)]
end

def process_with_cached_svg(content, svg, page_identifier, describer)
  blocks = Jekyll::UMLStatic.collect_code_blocks(content)
  renderer_hash = 'unit-test-renderer'
  cache = blocks.to_h { |block| [cache_key(renderer_hash, block), svg] }

  Dir.mktmpdir('uml-static-test') do |cache_dir|
    Jekyll::UMLStatic.instance_variable_set(:@cache, cache)
    Jekyll::UMLStatic.instance_variable_set(:@renderer_hash, renderer_hash)
    Jekyll::UMLStatic.instance_variable_set(:@cache_dir, cache_dir)
    node_path, describe_script_path = describer_command(describer)
    Jekyll::UMLStatic.instance_variable_set(:@node_path, node_path)
    Jekyll::UMLStatic.instance_variable_set(:@describe_script_path, describe_script_path)

    transformed = Jekyll::UMLStatic.process(
      content.dup,
      page_identifier: page_identifier
    )
    { html: transformed, cached_svg: cache.values.first }
  end
end

# Each input changes to its `changed_contents` entry, or gains a trailing line.
def renderer_fingerprints(file_contents, changed_contents)
  Dir.mktmpdir('uml-renderer-fingerprint-test') do |root|
    file_contents.each do |relative_path, contents|
      absolute_path = File.join(root, relative_path)
      FileUtils.mkdir_p(File.dirname(absolute_path))
      File.binwrite(absolute_path, contents)
    end

    baseline = Jekyll::UMLStatic.renderer_fingerprint(root)
    changed = file_contents.to_h do |relative_path, contents|
      absolute_path = File.join(root, relative_path)
      File.binwrite(absolute_path, changed_contents.fetch(relative_path, "#{contents}\nchanged"))
      fingerprint = Jekyll::UMLStatic.renderer_fingerprint(root)
      File.binwrite(absolute_path, contents)
      [relative_path, fingerprint]
    end

    {
      baseline: baseline,
      repeated: Jekyll::UMLStatic.renderer_fingerprint(root),
      changed: changed
    }
  end
end

payload = JSON.parse($stdin.read)

result = case payload.fetch('operation')
         when 'namespace_svg'
           {
             svg: Jekyll::UMLStatic.namespace_svg_ids(
               payload.fetch('svg'),
               payload.fetch('namespace')
             )
           }
         when 'collect_code_blocks'
           {
             blocks: Jekyll::UMLStatic.collect_code_blocks(payload.fetch('content')).map do |block|
               block.slice(:type, :text, :caption, :position)
             end
           }
         when 'collect_data_attribute_blocks'
           {
             blocks: Jekyll::UMLStatic.collect_data_attribute_blocks(payload.fetch('content')).map do |block|
               block.slice(:type, :text, :caption)
             end
           }
         when 'renderer_fingerprints'
           renderer_fingerprints(payload.fetch('file_contents'), payload.fetch('changed_contents', {}))
         when 'rewrite_syncbase_references'
           {
             value: Jekyll::UMLStatic.rewrite_syncbase_references(
               payload.fetch('value'),
               payload.fetch('id_mapping')
             )
           }
         when 'process_cached_svg'
           process_with_cached_svg(
             payload.fetch('content'),
             payload.fetch('svg'),
             payload.fetch('page_identifier'),
             payload.fetch('describer', 'stub')
           )
         else
           raise ArgumentError, "Unknown operation: #{payload['operation'].inspect}"
         end

$stdout.write(JSON.generate(result))
