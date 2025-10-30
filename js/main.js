document.addEventListener('DOMContentLoaded', () => {
    // --- 1. SETUP & CONFIGURATION ---
    const container = d3.select('#chart-container');
    const tooltip = d3.select('.tooltip');
    const controls = d3.select('.controls');
    
    const width = window.innerWidth;
    const height = window.innerHeight - 70; // Adjust for header height

    let i = 0;
    const duration = 750;
    let root; // <-- THIS IS THE FIX

    // Color scale for nodes based on depth
    const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

    // --- 2. SVG & ZOOM SETUP ---
    const svg = container.append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`);

    const g = svg.append('g');

    const zoom = d3.zoom()
        .scaleExtent([0.2, 4])
        .on('zoom', (event) => {
            g.attr('transform', event.transform);
        });

    svg.call(zoom);

    // --- 3. DATA LOADING & INITIAL RENDER ---
    d3.xml('data/mindmap.xml')
        .then(data => {
            d3.select('#loading-message').style('display', 'none');
            const xmlRoot = data.querySelector('mindmap > node');

            function xmlToHierarchy(xmlNode) {
                const children = Array.from(xmlNode.children).map(child => xmlToHierarchy(child));
                return {
                    id: xmlNode.getAttribute('id'),
                    name: xmlNode.getAttribute('text'),
                    children: children.length ? children : null
                };
            }

            const hierarchyData = xmlToHierarchy(xmlRoot);
            root = d3.hierarchy(hierarchyData);
            root.x0 = height / 2;
            root.y0 = 0;

            // Initial state: collapse all but the first level
            root.children.forEach(collapse);
            update(root);
        })
        .catch(error => {
            console.error('Error loading or parsing XML:', error);
            d3.select('#loading-message').text('Failed to load mindmap data.');
        });

    // --- 4. UI CONTROLS ---
    controls.select('#reset-zoom').on('click', () => {
        svg.transition().duration(750).call(
            zoom.transform,
            d3.zoomIdentity
        );
    });

    // --- 5. CORE INTERACTIVE FUNCTIONS ---
    function collapse(d) {
        if (d.children) {
            d._children = d.children;
            d._children.forEach(collapse);
            d.children = null;
        }
    }

    function click(event, d) {
        if (d.children) {
            d._children = d.children;
            d.children = null;
        } else {
            d.children = d._children;
            d._children = null;
        }
        update(d);
    }

    function showTooltip(event, d) {
        const fullText = d.data.name;
        const displayText = fullText.length > 25 ? fullText.substring(0, 22) + '...' : fullText;
        
        if (fullText !== displayText) {
            tooltip.transition().duration(200).style('opacity', .9);
            tooltip.html(fullText)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 28) + 'px');
        }
    }

    function hideTooltip() {
        tooltip.transition().duration(500).style('opacity', 0);
    }

    // --- 6. MAIN UPDATE FUNCTION ---
    function update(source) {
        const treeLayout = d3.tree().size([height - 100, width - 200]);
        const treeData = treeLayout(root);
        const nodes = treeData.descendants();
        const links = treeData.links();

        nodes.forEach(d => { d.y = d.depth * 250; });

        // --- NODES ---
        const node = g.selectAll('g.node')
            .data(nodes, d => d.id || (d.id = ++i));

        const nodeEnter = node.enter().append('g')
            .attr('class', 'node')
            .attr('transform', d => `translate(${source.y0}, ${source.x0})`)
            .on('click', click)
            .on('mouseover', showTooltip)
            .on('mouseout', hideTooltip);

        nodeEnter.append('circle')
            .attr('r', 1e-6);

        nodeEnter.append('text')
            .attr('dy', '.35em')
            .attr('x', d => d.children || d._children ? -13 : 13)
            .attr('text-anchor', d => d.children || d._children ? 'end' : 'start')
            .text(d => {
                const name = d.data.name;
                return name.length > 25 ? name.substring(0, 22) + '...' : name;
            });

        const nodeUpdate = nodeEnter.merge(node);

        nodeUpdate.transition()
            .duration(duration)
            .attr('transform', d => `translate(${d.y}, ${d.x})`);

        nodeUpdate.select('circle')
            .attr('r', 8)
            .style('fill', d => d._children ? getComputedStyle(document.documentElement).getPropertyValue('--collapsed-fill') : colorScale(d.depth))
            .style('stroke', d => d._children ? getComputedStyle(document.documentElement).getPropertyValue('--collapsed-fill') : getComputedStyle(document.documentElement).getPropertyValue('--node-stroke'));

        const nodeExit = node.exit().transition()
            .duration(duration)
            .attr('transform', d => `translate(${source.y}, ${source.x})`)
            .remove();

        nodeExit.select('circle').attr('r', 1e-6);
        nodeExit.select('text').style('fill-opacity', 1e-6);

        // --- LINKS ---
        const link = g.selectAll('path.link')
            .data(links, d => d.target.id);

        const linkEnter = link.enter().insert('path', 'g')
            .attr('class', 'link')
            .attr('d', d => {
                const o = {x: source.x0, y: source.y0};
                return diagonal(o, o);
            });

        const linkUpdate = linkEnter.merge(link);

        linkUpdate.transition()
            .duration(duration)
            .attr('d', d => diagonal(d.source, d.target));

        link.exit().transition()
            .duration(duration)
            .attr('d', d => {
                const o = {x: source.x, y: source.y};
                return diagonal(o, o);
            })
            .remove();

        nodes.forEach(d => {
            d.x0 = d.x;
            d.y0 = d.y;
        });
    }

    function diagonal(s, d) {
        return `M ${s.y} ${s.x}
                C ${(s.y + d.y) / 2} ${s.x},
                  ${(s.y + d.y) / 2} ${d.x},
                  ${d.y} ${d.x}`;
    }
});
