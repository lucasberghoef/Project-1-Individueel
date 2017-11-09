'use strict'

const colors = [ // The colors I'm going to use for the area and charts
    '#3a43ff', '#4effbc', '#b2ff4e', '#ff704e', '#ec2a2a', '#723aff', '#ff3b93'
]

// I've decided to use classes to split base functionality
class App {
    constructor() {
        // The constructor loads the JSON file and passes it's parsed content
        // to the charts and legend in the initialize function.
        d3.json('data.json', function (data) {
            this.data = data.map((show, i) => {
                show.color = colors[i]
                return show
            })
            this.initialize() // Start `initialize` after the data has loaded.
        }.bind(this))
    }

    initialize (data) {
        // The charts are attached to the class to make them reusable
        // for the `filter` function.
        this.line_chart = new LineChart(this.data)
        this.area_chart = new AreaChart(this.data)
        new Legend(this.data, this.filter.bind(this))
    }

    filter (shows) {
        // Filter the data array to only return the shows that are checked.
        const filteredData = this.data.filter((show) => {
            return shows.indexOf(show.slug) > -1
        })

        // Refresh the charts with the filtered dataset.
        this.line_chart.refresh(filteredData)
        this.area_chart.refresh(filteredData)
    }
}

class BaseChart {
    // This is an abstract function that allow me to write utility functions
    // only once.
    constructor (data) {
        this.data = data
    }

    flattenSeason (show) {
        // This function will return all episodes of a show in one array,
        // instead of seperate arrays per season.
        let episodes = []
        let counter = 0

        for (let season of show.seasons) {
            for (let episode of season.episodes) {
                episode.counter = counter // Add a counter to the episode
                episodes.push(episode)

                // Set the vote count for episodes without a rating to `null`.
                // This allows me to skip these episodes when rendering the chart.
                if (episode.vote_average <= 1 || episode.vote_count === 0) {
                    episode.vote_count = null
                }

                counter++
            }
        }

        return episodes
    }
}

class LineChart extends BaseChart {
    constructor (data) {
        super(data) // This will execute the constuctor in the `BaseChart`.

        // Initialize some basic properties needed by the chart.
        this.svg = d3.select('#lineChart')
        this.margin = { top: 20, right: 50, bottom: 30, left: 20 }
        this.width = +this.svg.attr('width') - this.margin.left - this.margin.right
        this.height = +this.svg.attr('height') - this.margin.top - this.margin.bottom
        this.g = this.svg.append('g')
            .attr('transform', 'translate(' + this.margin.left + ',' + this.margin.top + ')')

        this.x = d3.scaleLinear().rangeRound([0, this.width])
        this.y = d3.scaleLinear().rangeRound([this.height, 0])

        this.initialize()
    }

    initialize () {
        // Retrieve the amount of episodes per show, for use in the domain
        // function on the `x` axis.
        let episodeCounts = this.data.map((show) => this.getEpisodeCount(show))
        this.x.domain([0, d3.max(episodeCounts)])
        this.y.domain([0, 10])

        // Append the bottom axis.
        this.g.append('g')
            .attr('transform', 'translate(0,' + this.height + ')')
            .call(d3.axisBottom(this.x))
            .append('text')
            .attr('fill', '#fff')
            .attr('y', -12)
            .attr('x', this.width + 6)
            .attr('dy', '0.71em')
            .attr('text-anchor', 'start')
            .text('Episode')

        // Append the left axis.
        this.g.append('g')
            .call(d3.axisLeft(this.y))
            .append('text')
            .attr('fill', '#fff')
            .attr('transform', 'rotate(-90)')
            .attr('y', 6)
            .attr('dy', '0.71em')
            .attr('text-anchor', 'end')
            .text('Rating')

        // Render a seperate line per show.
        for (let show of this.data) {
            this.renderLine(show)
        }
    }

    refresh (data) {
        // Replace the internal data with filtered data.
        this.data = data
        // Remove all previously rendered lines from the chart.
        this.g.selectAll('.line').remove()
        // Re-render a line per show.
        for (let show of this.data) {
            this.renderLine(show)
        }
    }

    renderLine (dataSlice) {
        // See description in `flattenSeason` function.
        const episodes = this.flattenSeason(dataSlice)

        const line = d3.line()
            .defined((d) => d.vote_count) // Don't render episodes without votes
            .curve(d3.curveCatmullRom.alpha(0.2)) // Add a curve to the line for aesthetic pleasantness
            .x((d) => this.x(d.counter)) // Show the episode's counter on the `x` axis
            .y((d) => this.y(d.vote_average)) // Show the vote average on the `y` axis

        // Render the line
        this.g.append('path')
            .datum(episodes)
            .attr('class', 'line')
            .attr('fill', 'none')
            .attr('stroke', dataSlice.color) // Add a color to the line
            .attr('stroke-linejoins', 'round')
            .attr('stroke-linecap', 'round')
            .attr('stroke-width', 1.5)
            .attr('d', line)
    }

    getEpisodeCount (show) {
        // Retrieves he amount of episodes in a show
        let count = 0;
        for (let season of show.seasons) {
            count += season.episodes.length
        }
        return count
    }
}

// As the functions in this class is largely the same as in the `LineChart` class,
// this class will only contain comments that don't apply to the `LineChart`.
class AreaChart extends BaseChart {
    constructor (data) {
        super(data)

        this.svg = d3.select('#areaChart')
        this.margin = { top: 20, right: 50, bottom: 30, left: 20 }
        this.width = +this.svg.attr('width') - this.margin.left - this.margin.right
        this.height = +this.svg.attr('height') - this.margin.top - this.margin.bottom
        this.g = this.svg.append('g')
            .attr('transform', 'translate(' + this.margin.left + ',' + this.margin.top + ')')

        this.x = d3.scaleLinear().rangeRound([0, this.width])
        this.y = d3.scaleLinear().rangeRound([this.height, 0])

        this.initialize()
    }

    initialize () {
        this.x.domain([0, 10])
        this.y.domain([0, 30])

        this.g.append('g')
            .attr('transform', 'translate(0,' + this.height + ')')
            .call(d3.axisBottom(this.x))
            .append('text')
            .attr('fill', '#fff')
            .attr('y', -12)
            .attr('x', this.width + 6)
            .attr('dy', '0.71em')
            .attr('text-anchor', 'start')
            .text('Rating')

        this.g.append('g')
            .call(d3.axisLeft(this.y))
            .append('text')
            .attr('fill', '#fff')
            .attr('transform', 'rotate(-90)')
            .attr('y', 6)
            .attr('dy', '0.71em')
            .attr('text-anchor', 'end')
            .text('Frequency')

        for (let show of this.data) {
            this.renderArea(show)
        }
    }

    refresh (data) {
        this.data = data
        this.g.selectAll('.area').remove()
        for (let show of this.data) {
            this.renderArea(show)
        }
    }

    renderArea (dataSlice) {
        // Retrieve the rating frequency for all episodes in the show.
        const frequencies = this.getRatingFrequency(dataSlice)

        const area = d3.area()
            .curve(d3.curveCatmullRom.alpha(0.2))
            .x((d) => this.x(d.rating)) // Set the rating on the `x` axis
            .y0(this.y(0)) // Make sure our area always start at the bottom
            .y1((d) => this.y(d.frequency)) // Set the frequency on the `y` axis

        // Render the first half of all seasons in an area chart.
        this.g.append('path')
            .datum(frequencies.first_half)
            .attr('class', 'area')
            .attr('fill', dataSlice.color)
            .attr('opacity', 0.5) // Change the opacity to differ from the second half
            .attr('d', area)

        // Render the second half of all seasons in an area chart.
        this.g.append('path')
            .datum(frequencies.second_half)
            .attr('class', 'area')
            .attr('fill', dataSlice.color)
            .attr('opacity', 0.75) // Change the opacity to differ from the first half
            .attr('d', area)
    }

    getRatingFrequency (show) {
        // Count the amount of times each rating occurs in a show.
        let result = {
            first_half: [],
            second_half: [],
        }

        // Prepares the `result` object to store all the ratings.
        for (let i = 1; i <= 10; i++) {
            result.first_half[i - 1] = {
                rating: i,
                frequency: 0,
            }
            result.second_half[i - 1] = {
                rating: i,
                frequency: 0,
            }
        }

        // Register the ratings of the first half of all seasons
        for (let i = 0; i < Math.ceil(show.seasons.length / 2); i++) {
            const season = show.seasons[i]
            for (let episode of season.episodes) {
                const va = Math.round(episode.vote_average)
                if (va) result.first_half[va - 1].frequency++
            }
        }

        // Register the ratings of the second half of all seasons
        for (let i = Math.floor(show.seasons.length / 2); i < show.seasons.length; i++) {
            const season = show.seasons[i]
            for (let episode of season.episodes) {
                const va = Math.round(episode.vote_average)
                if (va) result.second_half[va - 1].frequency++
            }
        }

        return result
    }
}

class Legend {
    constructor (data, filter) {
        this.data = data
        // Attaches the filter function so we can communicate with the `App` class.
        this.filter = filter
        this.el = document.getElementById('legend')

        // Monitor for changes on the checkboxes
        this.el.addEventListener('change', (event) => {
            const boxes = this.el.querySelectorAll('input[type=checkbox]')
            let result = []

            for (let box of boxes) {
                if (box.checked) result.push(box.value)
            }

            // Send the values of all checked checkboxes back to the `App` class.
            this.filter(result)
        })

        this.initialize()
    }

    initialize() {
        // Clear the existing markup in case there's already something in there.
        this.el.innerHTML = ''
        // Create a checkbox for each show.
        for (let i = 0; i < this.data.length; i++) {
            let show = this.data[i]
            let element = this.createLegendElement(show, colors[i])
            this.el.appendChild(element)
        }
    }

    createLegendElement(show, color) {
        // Creates a checkbox element and attaches the defined color.
        let element = document.createElement('div')
        element.classList.add('legend__item')

        let input = document.createElement('input')
        input.id = show.slug
        input.setAttribute('type', 'checkbox')
        input.setAttribute('name', 'legend')
        input.setAttribute('value', show.slug)
        input.setAttribute('checked', true)
        element.appendChild(input)

        let label = document.createElement('label')
        label.setAttribute('for', show.slug)
        let span = document.createElement('span')
        span.style.backgroundColor = color
        label.appendChild(span)
        let text = document.createTextNode(show.title)
        label.appendChild(text)

        element.appendChild(label)

        return element
    }
}

// Start the app.
new App()
