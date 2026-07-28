<template>
  <span
    class="loading-spinner"
    :class="`loading-spinner-${size}`"
    role="status"
    :aria-label="label"
  />
</template>

<script>
export default {
    name: 'LoadingSpinner',
    props: {
        label: {
            type: String,
            default: 'Loading',
        },
        size: {
            type: String,
            default: 'md',
            validator(value) {
                return ['sm', 'md', 'lg'].includes(value);
            },
        },
    },
};
</script>

<style scoped>
.loading-spinner {
    animation: loading-spinner-rotate 0.75s linear infinite;
    border: 2px solid rgb(87 85 217 / 20%);
    border-radius: 999px;
    border-top-color: #5755d9;
    display: inline-block;
    flex: 0 0 auto;
}

.loading-spinner-sm {
    height: 0.8rem;
    width: 0.8rem;
}

.loading-spinner-md {
    height: 1.1rem;
    width: 1.1rem;
}

.loading-spinner-lg {
    height: 1.6rem;
    width: 1.6rem;
}

@keyframes loading-spinner-rotate {
    to {
        transform: rotate(360deg);
    }
}
</style>
