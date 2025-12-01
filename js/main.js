document.addEventListener('DOMContentLoaded', () => {
    // --- 1. CONFIGURATION ---
    const container = d3.select('#chart-container');
    const modal = document.getElementById('info-modal');
    const closeModalBtn = document.querySelector('.close-modal');
    
    const width = container.node().getBoundingClientRect().width;
    const height = container.node().getBoundingClientRect().height;
    const duration = 500;
    let i = 0;
    let root;

    // --- 2. URL PARAMETER HANDLING ---
    const urlParams = new URLSearchParams(window.location.search);
    const mapName = urlParams.get('map') || 'Steuern_in_der_Schweiz';
    const dataUrl = `data/${mapName}.json`;

    // --- 3. SVG SETUP ---
    const svg = container.append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('preserveAspectRatio', 'xMidYMid slice');

    const g = svg.append('g');

    const zoom = d3.zoom()
        .scaleExtent([0.1, 4])
        .on('zoom', (event) => g.attr('transform', event.transform));

    svg.call(zoom);

    // --- 4. DATA LOADING ---
    d3.json(dataUrl).then(data => {
        d3.select('#loading-message').style('display', 'none');
        d3.select('#map-title').text(data.name.replace(/_/g, ' '));

        root = d3.hierarchy(data);
        root.x0 = height / 2;
        root.y0 = width / 2;

        if (root.children) {
            root.children.forEach(collapseChildren);
        }

        update(root);
        centerNode(root);
    }).catch(err => {
        console.error(err);
        d3.select('#loading-message').text(`Error loading: ${dataUrl}`);
    });

    // --- 5. HELPER FUNCTIONS ---
    function collapseChildren(d) {
        if (d.children) {
            d._children = d.children;
            d._children.forEach(collapseChildren);
            d.children = null;
        }
    }

    function expandChildren(d) {
        if (d._children) {
            d.children = d._children;
            d.children.forEach(expandChildren);
            d._children = null;
        }
    }

    function centerNode(source) {
        const scale = d3.zoomTransform(svg.node()).k;
        const x = -source.y0 * scale + width / 2;
        const y = -source.x0 * scale + height / 2;
        svg.transition().duration(duration).call(
            zoom.transform, 
            d3.zoomIdentity.translate(x, y).scale(scale)
        );
    }

    // --- 6. UPDATE FUNCTION ---
    function update(source) {
        const treeLayout = d3.tree().nodeSize([60, 250]);
        const treeData = treeLayout(root);
        const nodes = treeData.descendants();
        const links = treeData.links();

        // --- NODES ---
        const node = g.selectAll('g.node')
            .data(nodes, d => d.id || (d.id = ++i));

        // Enter
        const nodeEnter = node.enter().append('g')
            .attr('class', 'node')
            .attr('transform', d => `translate(${source.y0},${source.x0})`)
            .on('click', clickNode); // Main click handler for expanding/collapsing

        // 1. Node Rectangle
        nodeEnter.append('rect')
            .attr('width', 180)
            .attr('height', 50)
            .attr('x', -90)
            .attr('y', -25)
            .attr('rx', 6)
            .attr('ry', 6);

        // 2. Node Text
        nodeEnter.append('foreignObject')
            .attr('width', 155) // Slightly smaller width to make room for icons
            .attr('height', 46)
            .attr('x', -88)
            .attr('y', -23)
            .append('xhtml:div')
            .html(d => d.data.name);

        // 3. Icons Container (Right side of node)
        const iconsGroup = nodeEnter.append('g')
            .attr('transform', 'translate(70, -15)'); // Position top-right inside node

        // --- LINK ICON (🔗) ---
        const linkIcon = iconsGroup.filter(d => d.data.link && d.data.link.trim() !== "")
            .append('g')
            .attr('class', 'node-icon')
            .on('click', (event, d) => {
                event.stopPropagation(); // Prevent node collapse
                window.open(d.data.link, '_blank');
            });
        
        // SVG Path for "External Link"
        linkIcon.append('path')
            .attr('d', "M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z")
            .attr('transform', 'scale(0.8)');

        // --- INFO ICON (ℹ️) ---
        const infoIcon = iconsGroup.filter(d => d.data.description && d.data.description.trim() !== "")
            .append('g')
            .attr('class', 'node-icon')
            .attr('transform', d => (d.data.link && d.data.link.trim() !== "") ? 'translate(0, 20)' : 'translate(0, 0)') // Stack icons if both exist
            .on('click', (event, d) => {
                event.stopPropagation(); // Prevent node collapse
                openModal(d.data.name, d.data.description);
            });

        // SVG Path for "Info Circle"
        infoIcon.append('path')
            .attr('d', "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z")
            .attr('transform', 'scale(0.8)');


        // Update Transitions
        const nodeUpdate = nodeEnter.merge(node);
        
        nodeUpdate.transition().duration(duration)
            .attr('transform', d => `translate(${d.y},${d.x})`);

        nodeUpdate.select('rect')
            .attr('class', d => d._children ? 'collapsed' : '')
            .style('fill', d => d._children ? '#238636' : '#1f2428');

        // Exit
        const nodeExit = node.exit().transition().duration(duration)
            .attr('transform', d => `translate(${source.y},${source.x})`)
            .remove();

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
        linkUpdate.transition().duration(duration)
            .attr('d', d => diagonal(d.source, d.target));

        link.exit().transition().duration(duration)
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

    // --- 7. INTERACTION HANDLERS ---
    
    function clickNode(event, d) {
        // Standard expand/collapse
        if (d.children) {
            d._children = d.children;
            d.children = null;
        } else {
            d.children = d._children;
            d._children = null;
        }
        update(d);
        centerNode(d);
    }

    function diagonal(s, d) {
        return `M ${s.y} ${s.x}
                C ${(s.y + d.y) / 2} ${s.x},
                  ${(s.y + d.y) / 2} ${d.x},
                  ${d.y} ${d.x}`;
    }

    // --- 8. MODAL LOGIC ---
    function openModal(title, description) {
        document.getElementById('modal-title').innerText = title;
        document.getElementById('modal-body').innerHTML = description; // innerHTML allows basic HTML in description
        modal.style.display = "block";
    }

    closeModalBtn.onclick = function() {
        modal.style.display = "none";
    }

    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    }

    // --- 9. BUTTON CONTROLS ---
    d3.select('#reset-zoom').on('click', () => centerNode(root));
    d3.select('#expand-all').on('click', () => {
        if(root._children) { root.children = root._children; root._children = null; }
        root.descendants().forEach(expandChildren);
        update(root);
        centerNode(root);
    });
    d3.select('#collapse-all').on('click', () => {
        root.children.forEach(collapseChildren);
        update(root);
        centerNode(root);
    });
});
