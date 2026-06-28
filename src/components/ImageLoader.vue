<template>
  <LoadingSpinner
    v-if="!loaded"
    class="card-loading"
    size="lg"
    label="Loading image"
  />
  <img
    v-bind="$attrs"
    :src="internalSrc"
    loading="lazy"
    decoding="async"
  >
  <img
    v-if="!loaded"
    :src="src"
    @load="onLoaded"
    class="hidden"
    loading="eager"
    decoding="async"
  >
</template>

<script>
import LoadingSpinner from './LoadingSpinner.vue';

export default {
    name: 'ImageLoader',
    components: {
        LoadingSpinner,
    },
    props: {
        src: {
            type: String,
            required: true,
        },
        placeholder: {
            type: String,
            required: true,
        },
    },
    data() {
        return {
            loaded: false,
        }
    },
    computed: {
        internalSrc() {
            return this.loaded ? this.src : this.placeholder;
        },
    },
    watch: {
        src: function() {
            this.loaded = false;
        },
    },
    methods: {
        onLoaded() {
            this.loaded = true;
        },
    },
}
</script>

<style scoped>
.card-loading {
    position: absolute;
    left: calc(50% - 0.8rem);
    top: 36%;
    z-index: 2;
}

img {
    position: relative;
    top: 0;
}

.hidden {
    display: none;
}
</style>
