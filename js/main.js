document.addEventListener('DOMContentLoaded', () => {
    // --- 1. CONFIGURATION ---
    const container = d3.select('#chart-container');
    
    // Text Modal Elements
    const infoModal = document.getElementById('info-modal');
    const closeInfoBtn = document.querySelector('.close-modal');
    
    // Link Modal Elements
    const linkModal = document.getElementById('link-modal');
    const closeLinkBtn = document.querySelector('.close-link-modal');
    const linkIframe = document.getElementById('link-iframe');
    const linkTitle = document.getElementById('link-title');
    const externalLinkBtn = document.getElementById('external-link-btn');

    const width = container.node().getBoundingClientRect().width;
    const height = container.node().getBoundingClientRect().height;
    const duration = 500;
    let i = 0;
    let root;

    // Node Dimensions
    const nodeWidth = 220;
    const baseHeight = 60;

    // Color Palette
    const palette = ['#58a6ff', '#bc8cff', '#ffa657', '#7ee787', '#ff7b72', '#39c5cf', '#ff9bce', '#d29922'];

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

        root.data.color = '#c9d1d9'; 
        if (root.children) {
            root.children.forEach((child, index) => {
                const branchColor = palette[index % palette.length];
                assignColorRecursive(child, branchColor);
            });
        }

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
    function assignColorRecursive(node, color) {
        node.data.color = color;
        if (node.children) node.children.forEach(c => assignColorRecursive(c, color));
        if (node._children) node._children.forEach(c => assignColorRecursive(c, color));
    }

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

    function getNodeHeight(d) {
        const charsPerLine = 28; 
        const textLength = d.data.name.length;
        const lines = Math.ceil(textLength / charsPerLine);
        return Math.max(baseHeight, 20 + (lines * 18));
    }

    // --- 6. UPDATE FUNCTION ---
    function update(source) {
        const treeLayout = d3.tree().nodeSize([100, 300]); 
        const treeData = treeLayout(root);
        const nodes = treeData.descendants();
        const links = treeData.links();

        const node = g.selectAll('g.node')
            .data(nodes, d => d.id || (d.id = ++i));

        const nodeEnter = node.enter().append('g')
            .attr('class', 'node')
            .attr('transform', d => `translate(${source.y0},${source.x0})`)
            .on('click', clickNode);

        nodeEnter.append('rect')
            .attr('width', nodeWidth)
            .attr('rx', 6).attr('ry', 6)
            .style('stroke-width', '1.5px');

        nodeEnter.append('foreignObject')
            .attr('width', nodeWidth - 35)
            .append('xhtml:div')
            .html(d => d.data.name);

        const iconsGroup = nodeEnter.append('g').attr('class', 'icons-group');

        // --- LINK ICON (UPDATED) ---
        const linkIcon = iconsGroup.filter(d => d.data.link && d.data.link.trim() !== "")
            .append('g').attr('class', 'node-icon')
            .on('click', (event, d) => {
                event.stopPropagation();
                // Open the Link Modal instead of window.open
                openLinkModal(d.data.name, d.data.link);
            });
        linkIcon.append('path')
            .attr('d', "M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z")
            .attr('transform', 'scale(0.8)');

        const infoIcon = iconsGroup.filter(d => d.data.description && d.data.description.trim() !== "")
            .append('g').attr('class', 'node-icon')
            .on('click', (event, d) => {
                event.stopPropagation();
                openInfoModal(d.data.name, d.data.description);
            });
        infoIcon.append('path')
            .attr('d', "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z")
            .attr('transform', 'scale(0.8)');

        const nodeUpdate = nodeEnter.merge(node);
        
        nodeUpdate.transition().duration(duration)
            .attr('transform', d => `translate(${d.y},${d.x})`);

        nodeUpdate.select('rect')
            .attr('height', d => getNodeHeight(d))
            .attr('y', d => -getNodeHeight(d) / 2)
            .attr('x', -nodeWidth / 2)
            .attr('class', d => d._children ? 'collapsed' : '')
            .style('stroke', d => d.data.color) 
            .style('fill', d => d._children ? d.data.color : '#1f2428');

        nodeUpdate.select('foreignObject')
            .attr('height', d => getNodeHeight(d))
            .attr('y', d => -getNodeHeight(d) / 2)
            .attr('x', (-nodeWidth / 2) + 5)
            .select('div')
            .style('color', d => d._children ? '#0d1117' : '#c9d1d9');

        nodeUpdate.select('.icons-group')
            .attr('transform', d => `translate(${(nodeWidth/2) - 25}, ${(-getNodeHeight(d)/2) + 10})`);
        
        nodeUpdate.selectAll('.node-icon')
            .attr('transform', (d, i) => `translate(0, ${i * 20})`)
            .style('fill', d => d._children ? '#0d1117' : '#8b949e');

        const nodeExit = node.exit().transition().duration(duration)
            .attr('transform', d => `translate(${source.y},${source.x})`)
            .remove();

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

    function clickNode(event, d) {
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

    // --- 7. MODAL LOGIC ---
    
    // Text Info Modal
    function openInfoModal(title, description) {
        document.getElementById('modal-title').innerText = title;
        document.getElementById('modal-body').innerHTML = description;
        infoModal.style.display = "block";
    }

    // Link Preview Modal
    function openLinkModal(title, url) {
        linkTitle.innerText = title;
        linkIframe.src = url; // Load URL in iframe
        externalLinkBtn.href = url; // Update fallback button
        linkModal.style.display = "block";
    }

    // Close Handlers
    closeInfoBtn.onclick = () => infoModal.style.display = "none";
    
    closeLinkBtn.onclick = () => {
        linkModal.style.display = "none";
        linkIframe.src = ""; // Clear src to stop video/audio
    };

    window.onclick = function(event) {
        if (event.target == infoModal) infoModal.style.display = "none";
        if (event.target == linkModal) {
            linkModal.style.display = "none";
            linkIframe.src = "";
        }
    }

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
