# frozen_string_literal: true

# Build-time tag graph:
# - counts how often tags appear together
# - scores each pair with cosine similarity and PMI / PPMI
# - keeps the strongest edges per tag so the SVG graph stays readable
#
# The result is exposed as site.data.tag_graph and embedded into /tags/.
module Wendell
  class TagGraphGenerator < Jekyll::Generator
    priority :low

    def generate(site)
      posts = site.posts.docs.reject { |post| post.data['hidden'] }
      post_count = posts.size

      if post_count.zero?
        site.data['tag_graph'] = { 'post_count' => 0, 'nodes' => [], 'edges' => [] }
        return
      end

      tag_counts = Hash.new(0)
      pair_counts = Hash.new(0)

      posts.each do |post|
        tags = Array(post.data['tags']).map(&:to_s).reject(&:empty?).uniq
        tags.each { |tag| tag_counts[tag] += 1 }
        tags.combination(2) do |a, b|
          pair_counts[[a, b].sort] += 1
        end
      end

      baseurl = site.baseurl.to_s.chomp('/')
      nodes = tag_counts.map do |tag, count|
        slug = Jekyll::Utils.slugify(tag)
        {
          'name' => tag,
          'slug' => slug,
          'count' => count,
          'url' => "#{baseurl}/tags/#{slug}/"
        }
      end.sort_by { |node| [-node['count'], node['name']] }

      edges = pair_counts.filter_map do |(a, b), cooccurrence|
        count_a = tag_counts[a]
        count_b = tag_counts[b]
        next if cooccurrence.zero? || count_a.zero? || count_b.zero?

        cosine = cooccurrence.to_f / Math.sqrt(count_a * count_b)
        pmi = Math.log((cooccurrence.to_f * post_count) / (count_a * count_b))
        ppmi = [pmi, 0.0].max

        {
          'source' => a,
          'target' => b,
          'cooccurrence' => cooccurrence,
          'cosine' => cosine.round(4),
          'pmi' => pmi.round(4),
          'ppmi' => ppmi.round(4)
        }
      end

      # A tag can have many weak links; keep its four strongest relationships.
      by_tag = Hash.new { |hash, key| hash[key] = [] }
      edges.each do |edge|
        by_tag[edge['source']] << edge
        by_tag[edge['target']] << edge
      end

      kept = {}
      by_tag.each_value do |tag_edges|
        tag_edges
          .sort_by { |edge| [-edge['cosine'], -edge['cooccurrence'], edge['source'], edge['target']] }
          .first(4)
          .each { |edge| kept[[edge['source'], edge['target']]] = edge }
      end

      edges = kept.values.sort_by { |edge| [-edge['cosine'], -edge['cooccurrence']] }

      site.data['tag_graph'] = {
        'post_count' => post_count,
        'nodes' => nodes,
        'edges' => edges
      }
    end
  end
end
